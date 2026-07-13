/**
 * hubRouter.ts
 * Endpoints tRPC para o módulo HUB AI & Data (Nexa Playbook).
 * Cobre: Gates G0-G4, Ciclo de Vida, Business Case, Artefatos e Métricas do HUB.
 */
import { z } from "zod";
import { eq, desc, sql, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import {
  intakeGatesHistory,
  intakeLifecycle,
  intakeBusinessCase,
  intakeArtifacts,
  intakeRequests,
  type InsertIntakeGateHistory,
  type InsertIntakeLifecycle,
  type InsertIntakeBusinessCase,
  type InsertIntakeArtifact,
} from "../drizzle/schema";

// ─── Schemas de validação ─────────────────────────────────────────────────────

const gateDecisionSchema = z.object({
  intakeId:  z.number().int().positive(),
  gateName:  z.enum(["G0", "G1", "G2", "G3", "G4"]),
  decision:  z.enum(["go", "no_go", "pendente"]),
  criteriaMet: z.object({
    impactosRiscos:          z.boolean().optional(),
    potencialFinanceiro:     z.boolean().optional(),
    viabilidadeOperacional:  z.boolean().optional(),
    viabilidadeTecnica:      z.boolean().optional(),
  }).optional(),
  comments: z.string().optional(),
});

const lifecyclePhaseSchema = z.object({
  intakeId: z.number().int().positive(),
  phase: z.enum([
    "descoberta_problema", "descoberta_hipoteses", "avaliacao_hipotese",
    "poc", "desenvolvimento_testes", "uat", "habilitacao_operacional",
    "hypercare", "lancamento_operacional", "sustentacao",
  ]),
  hypercareExitCriteria: z.array(z.object({
    criterion: z.string(),
    met: z.boolean(),
    verifiedAt: z.string().optional(),
  })).optional(),
});

const businessCaseSchema = z.object({
  intakeId:             z.number().int().positive(),
  reducesFte:           z.boolean().optional(),
  reducesFteValue:      z.number().optional(),
  avoidsInfraCosts:     z.boolean().optional(),
  avoidsInfraValue:     z.number().optional(),
  avoidsPenalties:      z.boolean().optional(),
  avoidsPenaltiesValue: z.number().optional(),
  avoidsFutureCosts:    z.boolean().optional(),
  avoidsFutureValue:    z.number().optional(),
  increasesEfficiency:  z.boolean().optional(),
  efficiencyValue:      z.number().optional(),
  intangibleBenefits:   z.string().optional(),
  capexTotal:           z.number().optional(),
  opexMonthly:          z.number().optional(),
  opexAnnual:           z.number().optional(),
  estimatedRoiMonths:   z.number().int().optional(),
  componentsCost: z.array(z.object({
    component:   z.string(),
    billingType: z.string(),
    monthlyVolume: z.string(),
    unitCost:    z.number(),
    isCapex:     z.boolean(),
  })).optional(),
  // Scores de priorização (1-3 conforme framework Nexa)
  scoreDataReadiness:   z.number().int().min(1).max(3).optional(),
  scoreTechReadiness:   z.number().int().min(1).max(3).optional(),
  scoreMaintenance:     z.number().int().min(1).max(3).optional(),
  scoreOrgReadiness:    z.number().int().min(1).max(3).optional(),
  scoreTimeline:        z.number().int().min(1).max(3).optional(),
  scoreStrategicValue:  z.number().int().min(1).max(3).optional(),
  scoreValueImpact:     z.number().int().min(1).max(3).optional(),
  scoreReusability:     z.number().int().min(1).max(3).optional(),
  scoreRiskProbability: z.number().int().min(1).max(3).optional(),
  scoreSecurity:        z.number().int().min(1).max(3).optional(),
  scoreRiskImpact:      z.number().int().min(1).max(3).optional(),
});

const artifactSchema = z.object({
  intakeId:     z.number().int().positive(),
  artifactType: z.enum([
    "ficha_hipotese", "business_case", "risk_assessment",
    "checklist_arquitetura", "checklist_compliance", "status_report",
    "uat_doc", "gmud", "handover", "knowledge_transfer", "outro",
  ]),
  title:         z.string().min(1).max(512),
  fileUrl:       z.string().url().optional(),
  fileName:      z.string().optional(),
  fileSizeBytes: z.number().int().optional(),
  mimeType:      z.string().optional(),
  notes:         z.string().optional(),
});

// ─── Regras de bloqueio de Gate (artefatos obrigatórios) ─────────────────────

const GATE_REQUIRED_ARTIFACTS: Record<string, string[]> = {
  G1: ["ficha_hipotese"],
  G2: ["business_case", "risk_assessment", "checklist_compliance"],
  G3: ["uat_doc"],
  G4: ["gmud", "handover", "knowledge_transfer"],
};

async function checkGateArtifacts(intakeId: number, gateName: string): Promise<string[]> {
  const required = GATE_REQUIRED_ARTIFACTS[gateName] ?? [];
  if (required.length === 0) return [];
  const drizzleDb = await getDb();
  if (!drizzleDb) return [];
  const existing = await drizzleDb
    .select({ artifactType: intakeArtifacts.artifactType })
    .from(intakeArtifacts)
    .where(eq(intakeArtifacts.intakeId, intakeId));
  const existingTypes = new Set(existing.map(a => a.artifactType));
  return required.filter(r => !existingTypes.has(r as typeof intakeArtifacts.artifactType._.data));
}

// ─── Router principal ─────────────────────────────────────────────────────────

export const hubRouter = router({

  // ── Gates ──────────────────────────────────────────────────────────────────

  /** Retorna o histórico de gates de uma demanda */
  getGates: protectedProcedure
    .input(z.object({ intakeId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const drizzleDb = await getDb();
      if (!drizzleDb) return [];
      return drizzleDb
        .select()
        .from(intakeGatesHistory)
        .where(eq(intakeGatesHistory.intakeId, input.intakeId))
        .orderBy(intakeGatesHistory.gateName);
    }),

  /** Registra ou atualiza a decisão de um Gate (GO / NO-GO) */
  decideGate: protectedProcedure
    .input(gateDecisionSchema)
    .mutation(async ({ input, ctx }) => {
      const missing = await checkGateArtifacts(input.intakeId, input.gateName);
      if (missing.length > 0 && input.decision === "go") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Artefatos obrigatórios ausentes para ${input.gateName} GO: ${missing.join(", ")}`,
        });
      }
      const drizzleDb = await getDb();
      if (!drizzleDb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const payload: InsertIntakeGateHistory = {
        intakeId:       input.intakeId,
        gateName:       input.gateName,
        decision:       input.decision,
        criteriaMet:    input.criteriaMet,
        approvedById:   ctx.user?.id,
        approvedByName: ctx.user?.name ?? undefined,
        decidedAt:      input.decision !== "pendente" ? new Date() : undefined,
        comments:       input.comments,
      };
      const [row] = await drizzleDb
        .insert(intakeGatesHistory)
        .values(payload)
        .returning();
      return row;
    }),

  // ── Ciclo de Vida ──────────────────────────────────────────────────────────

  /** Retorna o ciclo de vida atual de uma demanda */
  getLifecycle: protectedProcedure
    .input(z.object({ intakeId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const drizzleDb = await getDb();
      if (!drizzleDb) return null;
      const [row] = await drizzleDb
        .select()
        .from(intakeLifecycle)
        .where(eq(intakeLifecycle.intakeId, input.intakeId));
      return row ?? null;
    }),

  /** Avança a fase do ciclo de vida de uma demanda */
  advancePhase: protectedProcedure
    .input(lifecyclePhaseSchema)
    .mutation(async ({ input, ctx }) => {
      const drizzleDb = await getDb();
      if (!drizzleDb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const now = new Date().toISOString();
      const existing = await drizzleDb
        .select()
        .from(intakeLifecycle)
        .where(eq(intakeLifecycle.intakeId, input.intakeId));

      if (existing.length === 0) {
        // Cria o registro de ciclo de vida
        const [row] = await drizzleDb
          .insert(intakeLifecycle)
          .values({
            intakeId: input.intakeId,
            phase: input.phase,
            phaseHistory: [{ phase: input.phase, enteredAt: now, changedBy: ctx.user?.name ?? "sistema" }],
            hypercareStartedAt: input.phase === "hypercare" ? new Date() : undefined,
            hypercareExitCriteria: input.hypercareExitCriteria,
          })
          .returning();
        return row;
      }

      const current = existing[0];
      const history = (current.phaseHistory ?? []) as Array<{ phase: string; enteredAt: string; exitedAt?: string; changedBy?: string }>;
      if (history.length > 0) {
        history[history.length - 1].exitedAt = now;
      }
      history.push({ phase: input.phase, enteredAt: now, changedBy: ctx.user?.name ?? "sistema" });

      const [updated] = await drizzleDb
        .update(intakeLifecycle)
        .set({
          phase: input.phase,
          phaseHistory: history,
          hypercareStartedAt: input.phase === "hypercare" ? new Date() : current.hypercareStartedAt,
          hypercareExitCriteria: input.hypercareExitCriteria ?? current.hypercareExitCriteria,
          updatedAt: new Date(),
        })
        .where(eq(intakeLifecycle.intakeId, input.intakeId))
        .returning();
      return updated;
    }),

  // ── Business Case ──────────────────────────────────────────────────────────

  /** Retorna o business case de uma demanda */
  getBusinessCase: protectedProcedure
    .input(z.object({ intakeId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const drizzleDb = await getDb();
      if (!drizzleDb) return null;
      const [row] = await drizzleDb
        .select()
        .from(intakeBusinessCase)
        .where(eq(intakeBusinessCase.intakeId, input.intakeId));
      return row ?? null;
    }),

  /** Cria ou atualiza o business case de uma demanda */
  upsertBusinessCase: protectedProcedure
    .input(businessCaseSchema)
    .mutation(async ({ input, ctx }) => {
      const drizzleDb = await getDb();
      if (!drizzleDb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { intakeId, ...data } = input;
      const existing = await drizzleDb
        .select({ id: intakeBusinessCase.id })
        .from(intakeBusinessCase)
        .where(eq(intakeBusinessCase.intakeId, intakeId));

      if (existing.length === 0) {
        const payload: InsertIntakeBusinessCase = { intakeId, createdById: ctx.user?.id, ...data };
        const [row] = await drizzleDb.insert(intakeBusinessCase).values(payload).returning();
        return row;
      }
      const [updated] = await drizzleDb
        .update(intakeBusinessCase)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(intakeBusinessCase.intakeId, intakeId))
        .returning();
      return updated;
    }),

  // ── Artefatos ──────────────────────────────────────────────────────────────

  /** Lista os artefatos de uma demanda */
  listArtifacts: protectedProcedure
    .input(z.object({ intakeId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const drizzleDb = await getDb();
      if (!drizzleDb) return [];
      return drizzleDb
        .select()
        .from(intakeArtifacts)
        .where(eq(intakeArtifacts.intakeId, input.intakeId))
        .orderBy(desc(intakeArtifacts.uploadedAt));
    }),

  /** Adiciona um artefato a uma demanda */
  addArtifact: protectedProcedure
    .input(artifactSchema)
    .mutation(async ({ input, ctx }) => {
      const drizzleDb = await getDb();
      if (!drizzleDb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const payload: InsertIntakeArtifact = {
        ...input,
        uploadedById:   ctx.user?.id,
        uploadedByName: ctx.user?.name ?? undefined,
      };
      const [row] = await drizzleDb.insert(intakeArtifacts).values(payload).returning();
      return row;
    }),

  /** Remove um artefato */
  removeArtifact: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const drizzleDb = await getDb();
      if (!drizzleDb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await drizzleDb.delete(intakeArtifacts).where(eq(intakeArtifacts.id, input.id));
      return { success: true };
    }),

  /** Verifica quais artefatos obrigatórios ainda faltam para um Gate */
  checkMissingArtifacts: protectedProcedure
    .input(z.object({ intakeId: z.number().int().positive(), gateName: z.enum(["G0","G1","G2","G3","G4"]) }))
    .query(async ({ input }) => {
      const missing = await checkGateArtifacts(input.intakeId, input.gateName);
      return { missing, isReady: missing.length === 0 };
    }),

  // ── Métricas do HUB ────────────────────────────────────────────────────────

  /** Retorna as métricas gerenciais do portfólio de projetos de IA */
  getHubMetrics: protectedProcedure.query(async () => {
    const drizzleDb = await getDb();
    if (!drizzleDb) return { byStatus: [], byType: [], byTier: [], avgLeadTimeDays: 0, validationRate: 0, throughput90d: 0, totalActive: 0 };
    // Total de demandas por status
    const byStatus = await drizzleDb
      .select({
        status: intakeRequests.status,
        total: count(),
      })
      .from(intakeRequests)
      .groupBy(intakeRequests.status);

    // Lead Time médio (dias entre em_execucao e concluido) via ciclo de vida
    const leadTimeResult = await drizzleDb.execute(sql`
      SELECT
        ROUND(AVG(
          EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400
        ), 1) AS avg_lead_time_days
      FROM intake_lifecycle
      WHERE phase = 'lancamento_operacional'
    `);

    // Taxa de validação (concluidos / total finalizados)
    const concluded = byStatus.find(r => r.status === "concluido")?.total ?? 0;
    const rejected  = byStatus.find(r => r.status === "rejeitado")?.total ?? 0;
    const returned  = byStatus.find(r => r.status === "retornado")?.total ?? 0;
    const totalFinalized = Number(concluded) + Number(rejected) + Number(returned);
    const validationRate = totalFinalized > 0
      ? Math.round((Number(concluded) / totalFinalized) * 100)
      : 0;

    // Throughput: demandas concluídas nos últimos 90 dias
    const throughputResult = await drizzleDb.execute(sql`
      SELECT COUNT(*) AS throughput_90d
      FROM intake_requests
      WHERE status = 'concluido'
        AND "reviewedAt" >= NOW() - INTERVAL '90 days'
    `);

    // Distribuição por tipo de demanda
    const byType = await drizzleDb
      .select({
        type: intakeRequests.type,
        total: count(),
      })
      .from(intakeRequests)
      .groupBy(intakeRequests.type);

    // Distribuição por prioridade (tier)
    const byTier = await drizzleDb
      .select({
        tier: intakeRequests.priorityTier,
        total: count(),
      })
      .from(intakeRequests)
      .groupBy(intakeRequests.priorityTier);

    return {
      byStatus,
      byType,
      byTier,
      avgLeadTimeDays: Number((leadTimeResult.rows[0] as Record<string, unknown>)?.avg_lead_time_days ?? 0),
      validationRate,
      throughput90d: Number((throughputResult.rows[0] as Record<string, unknown>)?.throughput_90d ?? 0),
      totalActive: byStatus
        .filter(r => !["concluido", "rejeitado"].includes(r.status ?? ""))
        .reduce((acc, r) => acc + Number(r.total), 0),
    };
  }),
});

export type HubRouter = typeof hubRouter;
