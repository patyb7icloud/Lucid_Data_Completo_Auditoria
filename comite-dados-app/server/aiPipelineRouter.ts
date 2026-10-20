import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { aiProjectChecklists, aiProjectDecisions, aiProjects, externalProjectSyncs } from "../drizzle/schema";
import { AI_GATE_SEQUENCE, getGateIndex, getRequiredChecklist, type AiGate } from "../shared/aiProjectGates";
import { getDb } from "./db";
import { protectedProcedure, router, stewardProcedure } from "./_core/trpc";
import { configuredProjectSyncProviders, enqueueProjectSyncs, type ProjectSyncProvider } from "./projectSyncScheduler";

const gateSchema = z.enum(AI_GATE_SEQUENCE);
const organizationIdOf = (user: { organizationId?: number | null }) => user.organizationId ?? 1;
const isDecisionMaker = (role: string) => role === "admin" || role === "data_steward";

function requireHttpsEvidence(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Cada item concluído exige um link de evidência válido." });
  }
  if (parsed.protocol !== "https:") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "As evidências devem usar HTTPS." });
  }
  return parsed.toString();
}

export const aiPipelineRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    return db.select().from(aiProjects)
      .where(eq(aiProjects.organizationId, organizationIdOf(ctx.user)))
      .orderBy(aiProjects.createdAt);
  }),

  metrics: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    const all = await db.select().from(aiProjects)
      .where(eq(aiProjects.organizationId, organizationIdOf(ctx.user)));
    const total = all.length;
    const evaluated = all.filter(project => project.goNoGoStatus !== "pending").length;
    const approved = all.filter(project => project.goNoGoStatus === "go").length;
    const rejected = all.filter(project => project.goNoGoStatus === "no_go").length;
    return {
      total,
      evaluated,
      approved,
      rejected,
      approvedPercentage: evaluated ? Math.round((approved / evaluated) * 100) : 0,
      rejectedPercentage: evaluated ? Math.round((rejected / evaluated) * 100) : 0,
    };
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().trim().min(3).max(256),
      description: z.string().max(10000).optional(),
      department: z.string().max(128).optional(),
      projectType: z.string().trim().min(1).max(64).default("IA"),
      riskLevel: z.enum(["baixo", "medio", "alto", "critico"]).default("medio"),
      servicenowTicket: z.string().trim().max(128).optional(),
      azureDevopsUrl: z.string().url().max(512).optional().or(z.literal("")),
      termsAccepted: z.literal(true),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const now = new Date();
      const [project] = await db.insert(aiProjects).values({
        organizationId: organizationIdOf(ctx.user),
        name: input.name,
        description: input.description,
        department: input.department,
        projectType: input.projectType,
        riskLevel: input.riskLevel,
        servicenowTicket: input.servicenowTicket,
        azureDevopsUrl: input.azureDevopsUrl || undefined,
        termsAccepted: true,
        termsAcceptedById: ctx.user.id,
        termsAcceptedAt: now,
        ownerId: ctx.user.id,
        createdById: ctx.user.id,
        gate: "G0",
        status: "active",
        goNoGoStatus: "pending",
      }).returning();
      if (process.env.AUTO_SYNC_AI_PROJECTS === "true") {
        const providers = configuredProjectSyncProviders();
        if (providers.length) {
          try {
            await enqueueProjectSyncs(organizationIdOf(ctx.user), project.id, providers);
          } catch (error) {
            // A falha de enfileiramento não desfaz o intake; nenhuma chamada externa é feita aqui.
            console.error("integration.project_sync_enqueue_failed", {
              organizationId: organizationIdOf(ctx.user),
              projectId: project.id,
              errorClass: error instanceof Error ? error.name : "UnknownError",
            });
          }
        }
      }
      return project;
    }),

  syncExternal: stewardProcedure
    .input(z.object({
      id: z.number().int().positive(),
      providers: z.array(z.enum(["servicenow", "azure_devops"])).min(1).max(2).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const organizationId = organizationIdOf(ctx.user);
      const [project] = await db.select({ id: aiProjects.id }).from(aiProjects).where(and(
        eq(aiProjects.id, input.id), eq(aiProjects.organizationId, organizationId),
      )).limit(1);
      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Projeto não encontrado nesta organização." });
      const requestedProviders = (input.providers ?? configuredProjectSyncProviders()) as ProjectSyncProvider[];
      if (!requestedProviders.length) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Nenhum conector ServiceNow/Azure DevOps está configurado no servidor." });
      }
      const result = await enqueueProjectSyncs(organizationId, project.id, requestedProviders);
      if (!result.queued.length) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "As credenciais dos provedores selecionados não estão configuradas no servidor." });
      }
      return { ...result, message: "Sincronização enfileirada. O worker usará somente as credenciais configuradas no servidor." };
    }),

  syncStatus: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      return db.select().from(externalProjectSyncs).where(and(
        eq(externalProjectSyncs.projectId, input.id),
        eq(externalProjectSyncs.organizationId, organizationIdOf(ctx.user)),
      )).orderBy(externalProjectSyncs.createdAt);
    }),

  updateGoNoGo: stewardProcedure
    .input(z.object({
      id: z.number().int().positive(),
      status: z.enum(["go", "no_go"]),
      reason: z.string().trim().min(10).max(2000),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!isDecisionMaker(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin ou Data Steward pode registrar Go/No-Go." });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const organizationId = organizationIdOf(ctx.user);
      return db.transaction(async tx => {
        const [project] = await tx.select().from(aiProjects).where(and(
          eq(aiProjects.id, input.id),
          eq(aiProjects.organizationId, organizationId),
        )).limit(1);
        if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Projeto não encontrado nesta organização." });
        if (project.gate !== "G0" || project.goNoGoStatus !== "pending") {
          throw new TRPCError({ code: "CONFLICT", message: "A decisão Go/No-Go já foi registrada ou o projeto saiu de G0." });
        }
        if (project.createdById === ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "A decisão exige um decisor diferente de quem abriu o intake." });
        }
        const now = new Date();
        const [updated] = await tx.update(aiProjects).set({
          goNoGoStatus: input.status,
          decisionById: ctx.user.id,
          decisionAt: now,
          decisionReason: input.reason,
          updatedAt: now,
        }).where(and(
          eq(aiProjects.id, input.id),
          eq(aiProjects.organizationId, organizationId),
          eq(aiProjects.goNoGoStatus, "pending"),
        )).returning();
        if (!updated) throw new TRPCError({ code: "CONFLICT", message: "A decisão foi alterada simultaneamente. Atualize a página." });
        await tx.insert(aiProjectDecisions).values({
          organizationId,
          projectId: project.id,
          decisionType: "go_no_go",
          decision: input.status,
          fromGate: "G0",
          toGate: "G0",
          reason: input.reason,
          actorId: ctx.user.id,
          actorRole: ctx.user.role,
        });
        return updated;
      });
    }),

  updateGate: stewardProcedure
    .input(z.object({
      id: z.number().int().positive(),
      gate: gateSchema,
      items: z.array(z.object({
        itemKey: z.string().trim().min(1).max(128),
        evidenceLink: z.string().trim().min(1).max(1024),
      })).default([]),
      reason: z.string().trim().max(2000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const organizationId = organizationIdOf(ctx.user);
      return db.transaction(async tx => {
        const [project] = await tx.select().from(aiProjects).where(and(
          eq(aiProjects.id, input.id),
          eq(aiProjects.organizationId, organizationId),
        )).limit(1);
        if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Projeto não encontrado nesta organização." });
        const currentIndex = getGateIndex(project.gate);
        const targetIndex = getGateIndex(input.gate);
        if (currentIndex < 0 || targetIndex < 0 || Math.abs(targetIndex - currentIndex) !== 1) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Só são permitidas transições para o gate imediatamente anterior ou seguinte." });
        }
        const movingForward = targetIndex === currentIndex + 1;
        if (movingForward && !isDecisionMaker(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin ou Data Steward pode aprovar a transição." });
        }
        if (movingForward && project.gate === "G0" && project.goNoGoStatus !== "go") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "O Business Case precisa ter decisão GO antes de sair de G0." });
        }
        if (!movingForward) {
          if (ctx.user.role !== "admin") {
            throw new TRPCError({ code: "FORBIDDEN", message: "Rollback de gate exige Admin." });
          }
          if (!input.reason || input.reason.length < 10) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Informe uma justificativa de pelo menos 10 caracteres para o rollback." });
          }
        }

        const targetGate = input.gate as AiGate;
        let evidence: Array<{ itemKey: string; evidenceLink: string }> = [];
        if (movingForward) {
          const required = getRequiredChecklist(project.projectType, targetGate);
          const requiredKeys = required.map(item => item.key).sort();
          const receivedKeys = input.items.map(item => item.itemKey).sort();
          if (requiredKeys.length !== receivedKeys.length || requiredKeys.some((key, index) => key !== receivedKeys[index])) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "O checklist obrigatório está incompleto, contém duplicidades ou itens não reconhecidos." });
          }
          evidence = input.items.map(item => ({ itemKey: item.itemKey, evidenceLink: requireHttpsEvidence(item.evidenceLink) }));
          await tx.insert(aiProjectChecklists).values(evidence.map(item => {
            const definition = required.find(entry => entry.key === item.itemKey)!;
            return {
              organizationId,
              projectId: project.id,
              gate: targetGate,
              itemKey: item.itemKey,
              itemText: definition.label,
              evidenceLink: item.evidenceLink,
              checked: true,
              checkedById: ctx.user.id,
              checkedBy: ctx.user.name ?? ctx.user.email ?? `user:${ctx.user.id}`,
            };
          }));
        }

        const now = new Date();
        const [updated] = await tx.update(aiProjects).set({ gate: targetGate, updatedAt: now }).where(and(
          eq(aiProjects.id, project.id),
          eq(aiProjects.organizationId, organizationId),
          eq(aiProjects.gate, project.gate),
        )).returning();
        if (!updated) throw new TRPCError({ code: "CONFLICT", message: "O gate foi alterado simultaneamente. Atualize a página." });
        await tx.insert(aiProjectDecisions).values({
          organizationId,
          projectId: project.id,
          decisionType: movingForward ? "gate_transition" : "rollback",
          decision: movingForward ? "advanced" : "rolled_back",
          fromGate: project.gate,
          toGate: targetGate,
          reason: movingForward ? `Checklist ${targetGate} concluído e aprovado.` : input.reason!,
          evidence: movingForward ? evidence : undefined,
          actorId: ctx.user.id,
          actorRole: ctx.user.role,
        });
        return updated;
      });
    }),
});
