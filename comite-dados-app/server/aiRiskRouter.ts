/**
 * aiRiskRouter.ts
 * Lacuna 2: Gestão de Riscos de IA com Explicabilidade (XAI) e Conformidade
 */
import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { getDb } from "./db";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import {
  aiRiskAssessments,
  aiComplianceChecks,
  aiRiskHistory,
  type InsertAiRiskAssessment,
  type InsertAiComplianceCheck,
} from "../drizzle/schema";

// ─── Risk Assessments Router ──────────────────────────────────────────────────
const assessmentsRouter = router({
  list: publicProcedure
    .input(z.object({
      modelId: z.number().optional(),
      level: z.enum(["baixo", "medio", "alto", "critico"]).optional(),
      category: z.enum(["vies", "privacidade", "seguranca", "explicabilidade", "conformidade", "operacional"]).optional(),
      status: z.enum(["aberto", "em_mitigacao", "mitigado", "aceito"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [];
      if (input?.modelId) conditions.push(eq(aiRiskAssessments.modelId, input.modelId));
      if (input?.level) conditions.push(eq(aiRiskAssessments.level, input.level));
      if (input?.category) conditions.push(eq(aiRiskAssessments.category, input.category));
      if (input?.status) conditions.push(eq(aiRiskAssessments.status, input.status));
      return db
        .select()
        .from(aiRiskAssessments)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(aiRiskAssessments.updatedAt));
    }),

  byId: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [item] = await db
        .select()
        .from(aiRiskAssessments)
        .where(eq(aiRiskAssessments.id, input.id));
      return item ?? null;
    }),

  create: protectedProcedure
    .input(z.object({
      modelId: z.number().optional(),
      modelName: z.string().min(1),
      title: z.string().min(1),
      description: z.string().optional(),
      category: z.enum(["vies", "privacidade", "seguranca", "explicabilidade", "conformidade", "operacional"]),
      level: z.enum(["baixo", "medio", "alto", "critico"]).default("medio"),
      probability: z.number().min(1).max(5).default(3),
      impact: z.number().min(1).max(5).default(3),
      xaiMethod: z.string().optional(),
      xaiSummary: z.string().optional(),
      biasMetric: z.number().optional(),
      biasThreshold: z.number().optional(),
      mitigationPlan: z.string().optional(),
      mitigationDueAt: z.date().optional(),
      ownerName: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const riskScore = input.probability * input.impact;
      const data: InsertAiRiskAssessment = {
        ...input,
        riskScore,
        ownerId: ctx.user.id,
        ownerName: input.ownerName ?? ctx.user.name ?? undefined,
        createdById: ctx.user.id,
      };
      const [created] = await db.insert(aiRiskAssessments).values(data).returning();
      await _snapshotRiskHistory(input.modelId, input.modelName);
      return created;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      description: z.string().optional(),
      level: z.enum(["baixo", "medio", "alto", "critico"]).optional(),
      status: z.enum(["aberto", "em_mitigacao", "mitigado", "aceito"]).optional(),
      probability: z.number().min(1).max(5).optional(),
      impact: z.number().min(1).max(5).optional(),
      xaiMethod: z.string().optional(),
      xaiSummary: z.string().optional(),
      biasMetric: z.number().optional(),
      mitigationPlan: z.string().optional(),
      mitigationDueAt: z.date().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, probability, impact, ...rest } = input;
      const extra: Record<string, unknown> = {};
      if (probability !== undefined || impact !== undefined) {
        const [current] = await db
          .select({ probability: aiRiskAssessments.probability, impact: aiRiskAssessments.impact })
          .from(aiRiskAssessments)
          .where(eq(aiRiskAssessments.id, id));
        const p = probability ?? current?.probability ?? 3;
        const i = impact ?? current?.impact ?? 3;
        extra.riskScore = p * i;
      }
      const [updated] = await db
        .update(aiRiskAssessments)
        .set({ ...rest, probability, impact, ...extra, updatedAt: new Date() })
        .where(eq(aiRiskAssessments.id, id))
        .returning();
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(aiRiskAssessments).where(eq(aiRiskAssessments.id, input.id));
      return { success: true };
    }),

  summary: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, byLevel: {}, byCategory: {}, byStatus: {}, avgRiskScore: 0, openCritical: 0 };
    const all = await db.select().from(aiRiskAssessments);
    const byLevel = all.reduce((acc, r) => { acc[r.level] = (acc[r.level] ?? 0) + 1; return acc; }, {} as Record<string, number>);
    const byCategory = all.reduce((acc, r) => { acc[r.category] = (acc[r.category] ?? 0) + 1; return acc; }, {} as Record<string, number>);
    const byStatus = all.reduce((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; }, {} as Record<string, number>);
    const avgRiskScore = all.length > 0
      ? Math.round(all.reduce((s, r) => s + (r.riskScore ?? 0), 0) / all.length)
      : 0;
    return {
      total: all.length,
      byLevel,
      byCategory,
      byStatus,
      avgRiskScore,
      openCritical: all.filter(r => r.level === "critico" && r.status === "aberto").length,
    };
  }),
});

// ─── Compliance Router ────────────────────────────────────────────────────────
const complianceRouter = router({
  list: publicProcedure
    .input(z.object({
      modelId: z.number().optional(),
      framework: z.enum(["lgpd", "eu_ai_act", "iso_42001", "nist_ai_rmf"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [];
      if (input?.modelId) conditions.push(eq(aiComplianceChecks.modelId, input.modelId));
      if (input?.framework) conditions.push(eq(aiComplianceChecks.framework, input.framework));
      return db
        .select()
        .from(aiComplianceChecks)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(aiComplianceChecks.checkedAt));
    }),

  upsert: protectedProcedure
    .input(z.object({
      modelId: z.number().optional(),
      modelName: z.string().min(1),
      framework: z.enum(["lgpd", "eu_ai_act", "iso_42001", "nist_ai_rmf"]),
      checkName: z.string().min(1),
      description: z.string().optional(),
      passed: z.boolean(),
      evidence: z.string().optional(),
      notes: z.string().optional(),
      nextReviewAt: z.date().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const data: InsertAiComplianceCheck = {
        ...input,
        checkedById: ctx.user.id,
        checkedAt: new Date(),
      };
      const [upserted] = await db.insert(aiComplianceChecks).values(data).returning();
      return upserted;
    }),

  scoreByModel: publicProcedure
    .input(z.object({ modelName: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const checks = await db
        .select()
        .from(aiComplianceChecks)
        .where(eq(aiComplianceChecks.modelName, input.modelName));
      return (["lgpd", "eu_ai_act", "iso_42001", "nist_ai_rmf"] as const).map(fw => {
        const fwChecks = checks.filter(c => c.framework === fw);
        const passed = fwChecks.filter(c => c.passed).length;
        const total = fwChecks.length;
        return { framework: fw, passed, total, score: total > 0 ? Math.round((passed / total) * 100) : 0 };
      });
    }),
});

// ─── Risk History Router ──────────────────────────────────────────────────────
const historyRouter = router({
  byModel: publicProcedure
    .input(z.object({ modelName: z.string(), limit: z.number().default(12) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(aiRiskHistory)
        .where(eq(aiRiskHistory.modelName, input.modelName))
        .orderBy(desc(aiRiskHistory.recordedAt))
        .limit(input.limit);
    }),
});

// ─── Helper: snapshot de risco ────────────────────────────────────────────────
async function _snapshotRiskHistory(modelId: number | undefined, modelName: string) {
  const db = await getDb();
  if (!db) return;
  const risks = await db
    .select()
    .from(aiRiskAssessments)
    .where(
      modelId
        ? eq(aiRiskAssessments.modelId, modelId)
        : eq(aiRiskAssessments.modelName, modelName)
    );
  const openCount = risks.filter(r => r.status === "aberto").length;
  const criticalCount = risks.filter(r => r.level === "critico").length;
  const riskScore = risks.length > 0
    ? Math.round(risks.reduce((s, r) => s + (r.riskScore ?? 0), 0) / risks.length)
    : 0;
  await db.insert(aiRiskHistory).values({ modelId, modelName, riskScore, openCount, criticalCount });
}

export const aiRiskRouter = router({
  assessments: assessmentsRouter,
  compliance: complianceRouter,
  history: historyRouter,
});
