/**
 * workflowEngine.ts
 * Motor de aprovações: inicia fluxos, avança steps, notifica aprovadores.
 *
 * Suporta:
 *   - Aprovação sequencial (step a step)
 *   - Aprovação paralela (todos devem aprovar antes de avançar)
 *   - Notificação (sem aprovação, apenas alerta por email)
 *
 * Definição de step (em stepsJson):
 * [{
 *   id: string,
 *   type: "approval" | "parallel_approval" | "notification",
 *   label: string,
 *   approvers: string[],      // openIds dos aprovadores
 *   parallelAll: boolean,     // true = todos aprovam; false = qualquer um aprova
 *   notifyEmails: string[],   // emails adicionais para notificar
 * }]
 */
import * as db from "./db";
import { logger } from "./_core/logger";

type StepType = "approval" | "parallel_approval" | "notification";

interface WorkflowStep {
  id: string;
  type: StepType;
  label: string;
  approvers?: string[]; // openIds
  parallelAll?: boolean;
  notifyEmails?: string[];
}

// ─── Trigger (inicia uma nova instância) ─────────────────────────────────────
export async function triggerWorkflow(opts: {
  definitionId: number;
  entityType: string;
  entityId: number;
  initiatorOpenId: string;
  context?: Record<string, unknown>;
}) {
  const def = await db.getWorkflowDefinitionById(opts.definitionId);
  if (!def || !def.active) {
    throw new Error(`Workflow definition ${opts.definitionId} not found or inactive.`);
  }

  const instance = await db.createWorkflowInstance({
    definitionId: opts.definitionId,
    entityType: opts.entityType,
    entityId: opts.entityId,
    currentStep: 0,
    status: "pending",
    initiatorOpenId: opts.initiatorOpenId,
    contextJson: opts.context ?? null,
    startedAt: new Date(),
  });

  logger.info("workflow.triggered", {
    instanceId: instance?.id,
    definitionId: opts.definitionId,
    entityType: opts.entityType,
    entityId: opts.entityId,
  });

  // Se o primeiro step for notificação, avança automaticamente
  if (instance) {
    const steps = def.stepsJson as WorkflowStep[];
    if (steps[0]?.type === "notification") {
      await _processNotificationStep(instance.id, steps[0]);
      await _tryAdvance(instance.id);
    }
  }

  return instance;
}

// ─── Decision (aprovador toma uma decisão num step) ───────────────────────────
export async function recordDecision(opts: {
  instanceId: number;
  actorOpenId: string;
  actorName?: string;
  decision: "approved" | "rejected" | "delegated" | "commented";
  comment?: string;
}) {
  const instance = await db.getWorkflowInstanceById(opts.instanceId);
  if (!instance) throw new Error(`Instance ${opts.instanceId} not found.`);
  if (instance.status !== "pending") {
    throw new Error(`Instance ${opts.instanceId} is already ${instance.status}.`);
  }

  const def = await db.getWorkflowDefinitionById(instance.definitionId);
  if (!def) throw new Error("Workflow definition not found.");

  const steps = def.stepsJson as WorkflowStep[];
  const stepDef = steps[instance.currentStep];
  if (!stepDef) throw new Error("Invalid step index.");

  // Verifica se o actor é aprovador deste step
  if (stepDef.approvers && !stepDef.approvers.includes(opts.actorOpenId)) {
    throw new Error("You are not an approver for this step.");
  }

  // Registra a ação
  await db.createWorkflowStepAction({
    instanceId: opts.instanceId,
    stepIndex: instance.currentStep,
    actorOpenId: opts.actorOpenId,
    actorName: opts.actorName,
    decision: opts.decision,
    comment: opts.comment,
  });

  logger.info("workflow.decision", {
    instanceId: opts.instanceId,
    stepIndex: instance.currentStep,
    actor: opts.actorOpenId,
    decision: opts.decision,
  });

  // Se rejeitado, encerra o fluxo
  if (opts.decision === "rejected") {
    await db.updateWorkflowInstance(opts.instanceId, {
      status: "rejected",
      completedAt: new Date(),
    });
    return db.getWorkflowInstanceById(opts.instanceId);
  }

  // Se comentário ou delegado, não avança automaticamente
  if (opts.decision !== "approved") {
    return db.getWorkflowInstanceById(opts.instanceId);
  }

  // Aprovado: verifica condição de avanço do step atual
  await _tryAdvance(opts.instanceId);
  return db.getWorkflowInstanceById(opts.instanceId);
}

// ─── Cancelar instância ───────────────────────────────────────────────────────
export async function cancelWorkflow(instanceId: number) {
  await db.updateWorkflowInstance(instanceId, {
    status: "cancelled",
    completedAt: new Date(),
  });
  logger.info("workflow.cancelled", { instanceId });
  return db.getWorkflowInstanceById(instanceId);
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

async function _tryAdvance(instanceId: number) {
  const instance = await db.getWorkflowInstanceById(instanceId);
  if (!instance || instance.status !== "pending") return;

  const def = await db.getWorkflowDefinitionById(instance.definitionId);
  if (!def) return;

  const steps = def.stepsJson as WorkflowStep[];
  const stepDef = steps[instance.currentStep];
  if (!stepDef) return;

  const canAdvance = await _canAdvanceStep(instanceId, instance.currentStep, stepDef);
  if (!canAdvance) return;

  const nextStep = instance.currentStep + 1;

  // Verifica se há próximo step
  if (nextStep >= steps.length) {
    // Fluxo completo
    await db.updateWorkflowInstance(instanceId, {
      status: "approved",
      completedAt: new Date(),
    });
    logger.info("workflow.completed", { instanceId });
    return;
  }

  // Avança para o próximo step
  await db.updateWorkflowInstance(instanceId, { currentStep: nextStep });

  // Se o próximo step é notificação, processa automaticamente
  const nextStepDef = steps[nextStep];
  if (nextStepDef?.type === "notification") {
    await _processNotificationStep(instanceId, nextStepDef);
    await _tryAdvance(instanceId); // recursão para checar se pode avançar mais
  }
}

async function _canAdvanceStep(instanceId: number, stepIndex: number, stepDef: WorkflowStep): Promise<boolean> {
  if (stepDef.type === "notification") return true;

  const actions = await db.getWorkflowStepActions(instanceId);
  const stepActions = actions.filter((a) => a.stepIndex === stepIndex && a.decision === "approved");

  if (stepDef.type === "approval") {
    // Qualquer aprovação é suficiente
    return stepActions.length >= 1;
  }

  if (stepDef.type === "parallel_approval") {
    const approvers = stepDef.approvers ?? [];
    if (approvers.length === 0) return true;

    if (stepDef.parallelAll) {
      // Todos os aprovadores devem aprovar
      const approvedBy = new Set(stepActions.map((a) => a.actorOpenId));
      return approvers.every((ap) => approvedBy.has(ap));
    } else {
      // Qualquer um dos aprovadores basta
      return stepActions.length >= 1;
    }
  }

  return false;
}

async function _processNotificationStep(instanceId: number, stepDef: WorkflowStep) {
  // Log apenas — integração com emailService pode ser adicionada aqui
  logger.info("workflow.notification_step", {
    instanceId,
    stepId: stepDef.id,
    label: stepDef.label,
    notifyEmails: stepDef.notifyEmails ?? [],
  });
}
