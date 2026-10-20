/**
 * aiRiskRouter.ts
 * Gestão de riscos de IA, avaliações de evidência/readiness e fairness contextual.
 *
 * Importante: os registros deste router não constituem certificação, parecer jurídico
 * ou declaração universal de fairness. Toda conclusão final exige revisão humana.
 */
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { protectedProcedure, router } from "./_core/trpc";
import {
  aiRiskAssessments,
  aiComplianceChecks,
  aiRiskHistory,
  aiFairnessAssessments,
  mlModels,
  type InsertAiRiskAssessment,
  type InsertAiComplianceCheck,
} from "../drizzle/schema";

const FRAMEWORKS = ["lgpd", "eu_ai_act", "iso_42001", "nist_ai_rmf"] as const;
const COMPLIANCE_FINAL_STATUSES = ["passed", "failed", "not_applicable"] as const;
const COMPLIANCE_UNREVIEWED_STATUSES = ["not_assessed", "pending_review", "evidence_missing"] as const;
const REVIEWER_ROLES = ["admin", "data_steward"] as const;

type Framework = (typeof FRAMEWORKS)[number];
type ComplianceFinalStatus = (typeof COMPLIANCE_FINAL_STATUSES)[number];
type UserLike = { id: number; role?: string | null; organizationId?: number | null };

/** Exportada para testes e para manter o cálculo determinístico e sem dados de linha. */
export type FairnessGroupInput = {
  code: string;
  sampleSize: number;
  positivePredictionCount: number;
  actualPositiveCount?: number;
  truePositiveCount?: number;
};

export type FairnessGroupAggregate = FairnessGroupInput & {
  selectionRate: number;
  truePositiveRate: number | null;
};

export type FairnessMetrics = {
  selectionRateMin: number;
  selectionRateMax: number;
  statisticalParityDifference: number;
  disparateImpactRatio: number | null;
  equalOpportunityDifference: number | null;
  totalSampleSize: number;
  groupCount: number;
};

export function calculateFairnessMetrics(groups: FairnessGroupInput[]): {
  groups: FairnessGroupAggregate[];
  metrics: FairnessMetrics;
} {
  const aggregates = groups.map(group => ({
    ...group,
    selectionRate: group.sampleSize > 0 ? group.positivePredictionCount / group.sampleSize : 0,
    truePositiveRate:
      group.actualPositiveCount !== undefined && group.actualPositiveCount > 0
        ? (group.truePositiveCount ?? 0) / group.actualPositiveCount
        : null,
  }));
  const selectionRates = aggregates.map(group => group.selectionRate);
  const selectionRateMin = Math.min(...selectionRates);
  const selectionRateMax = Math.max(...selectionRates);
  const tprs = aggregates
    .map(group => group.truePositiveRate)
    .filter((value): value is number => value !== null);
  const metrics: FairnessMetrics = {
    selectionRateMin,
    selectionRateMax,
    statisticalParityDifference: selectionRateMax - selectionRateMin,
    disparateImpactRatio: selectionRateMax > 0 ? selectionRateMin / selectionRateMax : null,
    equalOpportunityDifference: tprs.length === aggregates.length && tprs.length > 0
      ? Math.max(...tprs) - Math.min(...tprs)
      : null,
    totalSampleSize: groups.reduce((sum, group) => sum + group.sampleSize, 0),
    groupCount: groups.length,
  };
  return { groups: aggregates, metrics };
}

export function organizationIdFor(user: UserLike): number {
  return user.organizationId ?? 1;
}

export function isReviewer(user: UserLike): boolean {
  return REVIEWER_ROLES.includes(user.role as (typeof REVIEWER_ROLES)[number]);
}

export function canManageRisk(user: UserLike, record: { ownerId: number | null; createdById: number | null }): boolean {
  return isReviewer(user) || record.ownerId === user.id || record.createdById === user.id;
}

function badRequest(message: string): never {
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

function notFound(message: string): never {
  throw new TRPCError({ code: "NOT_FOUND", message });
}

function forbidden(message: string): never {
  throw new TRPCError({ code: "FORBIDDEN", message });
}

function trimOrUndefined(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

async function modelInTenant(db: Awaited<ReturnType<typeof getDb>>, modelId: number, organizationId: number) {
  if (!db) throw new Error("Database unavailable");
  const [model] = await db
    .select({ id: mlModels.id, name: mlModels.name, version: mlModels.version })
    .from(mlModels)
    .where(and(eq(mlModels.id, modelId), eq(mlModels.organizationId, organizationId)));
  if (!model) notFound("Modelo não encontrado nesta organização.");
  return model;
}

async function ensureModelIfProvided(
  db: Awaited<ReturnType<typeof getDb>>,
  modelId: number | undefined,
  organizationId: number,
) {
  return modelId === undefined ? undefined : modelInTenant(db, modelId, organizationId);
}

async function findPendingCompliance(
  db: Awaited<ReturnType<typeof getDb>>,
  organizationId: number,
  modelId: number | undefined,
  modelName: string,
  framework: Framework,
  checkName: string,
) {
  if (!db) throw new Error("Database unavailable");
  const conditions = [
    eq(aiComplianceChecks.organizationId, organizationId),
    eq(aiComplianceChecks.framework, framework),
    eq(aiComplianceChecks.checkName, checkName),
    modelId === undefined ? eq(aiComplianceChecks.modelName, modelName) : eq(aiComplianceChecks.modelId, modelId),
  ];
  const candidates = await db.select().from(aiComplianceChecks).where(and(...conditions));
  return candidates.find(check =>
    check.reviewedAt === null &&
    check.reviewerId === null &&
    COMPLIANCE_UNREVIEWED_STATUSES.includes(check.status as (typeof COMPLIANCE_UNREVIEWED_STATUSES)[number]),
  );
}

const assessmentFilter = z.object({
  modelId: z.number().int().positive().optional(),
  level: z.enum(["baixo", "medio", "alto", "critico"]).optional(),
  category: z.enum(["vies", "privacidade", "seguranca", "explicabilidade", "conformidade", "operacional"]).optional(),
  status: z.enum(["aberto", "em_mitigacao", "mitigado", "aceito"]).optional(),
}).optional();

// ─── Risk assessments ──────────────────────────────────────────────────────────
const assessmentsRouter = router({
  list: protectedProcedure.input(assessmentFilter).query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const conditions = [eq(aiRiskAssessments.organizationId, organizationIdFor(ctx.user))];
    if (input?.modelId !== undefined) conditions.push(eq(aiRiskAssessments.modelId, input.modelId));
    if (input?.level) conditions.push(eq(aiRiskAssessments.level, input.level));
    if (input?.category) conditions.push(eq(aiRiskAssessments.category, input.category));
    if (input?.status) conditions.push(eq(aiRiskAssessments.status, input.status));
    return db.select().from(aiRiskAssessments).where(and(...conditions)).orderBy(desc(aiRiskAssessments.updatedAt));
  }),

  byId: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const [item] = await db.select().from(aiRiskAssessments).where(and(
      eq(aiRiskAssessments.id, input.id),
      eq(aiRiskAssessments.organizationId, organizationIdFor(ctx.user)),
    ));
    return item ?? null;
  }),

  create: protectedProcedure.input(z.object({
    modelId: z.number().int().positive().optional(),
    modelName: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
    category: z.enum(["vies", "privacidade", "seguranca", "explicabilidade", "conformidade", "operacional"]),
    level: z.enum(["baixo", "medio", "alto", "critico"]).default("medio"),
    probability: z.number().int().min(1).max(5).default(3),
    impact: z.number().int().min(1).max(5).default(3),
    xaiMethod: z.string().optional(),
    xaiSummary: z.string().optional(),
    biasMetric: z.number().optional(),
    biasThreshold: z.number().optional(),
    mitigationPlan: z.string().optional(),
    mitigationDueAt: z.date().optional(),
    // Aceito para compatibilidade de cliente, mas deliberadamente ignorado.
    ownerName: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const organizationId = organizationIdFor(ctx.user);
    const model = await ensureModelIfProvided(db, input.modelId, organizationId);
    const { ownerName: _clientOwnerName, ...safeInput } = input;
    const riskScore = input.probability * input.impact;
    const data: InsertAiRiskAssessment = {
      ...safeInput,
      organizationId,
      modelName: model?.name ?? input.modelName,
      riskScore,
      ownerId: ctx.user.id,
      ownerName: ctx.user.name ?? ctx.user.email ?? undefined,
      createdById: ctx.user.id,
    };
    const [created] = await db.insert(aiRiskAssessments).values(data).returning();
    await snapshotRiskHistory(db, organizationId, input.modelId, data.modelName);
    return created;
  }),

  update: protectedProcedure.input(z.object({
    id: z.number().int().positive(),
    title: z.string().optional(),
    description: z.string().optional(),
    level: z.enum(["baixo", "medio", "alto", "critico"]).optional(),
    status: z.enum(["aberto", "em_mitigacao", "mitigado", "aceito"]).optional(),
    probability: z.number().int().min(1).max(5).optional(),
    impact: z.number().int().min(1).max(5).optional(),
    xaiMethod: z.string().optional(),
    xaiSummary: z.string().optional(),
    biasMetric: z.number().optional(),
    mitigationPlan: z.string().optional(),
    mitigationDueAt: z.date().optional(),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const organizationId = organizationIdFor(ctx.user);
    const [current] = await db.select().from(aiRiskAssessments).where(and(
      eq(aiRiskAssessments.id, input.id),
      eq(aiRiskAssessments.organizationId, organizationId),
    ));
    if (!current) notFound("Avaliação de risco não encontrada nesta organização.");
    if (!canManageRisk(ctx.user, current)) forbidden("Apenas o responsável, Admin ou Data Steward podem alterar este risco.");

    const { id: _id, probability, impact, ...rest } = input;
    const updates: Partial<InsertAiRiskAssessment> & { updatedAt: Date } = { ...rest, updatedAt: new Date() };
    if (probability !== undefined) updates.probability = probability;
    if (impact !== undefined) updates.impact = impact;
    if (probability !== undefined || impact !== undefined) {
      updates.riskScore = (probability ?? current.probability ?? 3) * (impact ?? current.impact ?? 3);
    }
    const [updated] = await db.update(aiRiskAssessments).set(updates).where(and(
      eq(aiRiskAssessments.id, input.id),
      eq(aiRiskAssessments.organizationId, organizationId),
    )).returning();
    await snapshotRiskHistory(db, organizationId, current.modelId ?? undefined, current.modelName);
    return updated;
  }),

  delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const organizationId = organizationIdFor(ctx.user);
    const [current] = await db.select().from(aiRiskAssessments).where(and(
      eq(aiRiskAssessments.id, input.id),
      eq(aiRiskAssessments.organizationId, organizationId),
    ));
    if (!current) notFound("Avaliação de risco não encontrada nesta organização.");
    if (!canManageRisk(ctx.user, current)) forbidden("Apenas o responsável, Admin ou Data Steward podem remover este risco.");
    await db.delete(aiRiskAssessments).where(and(
      eq(aiRiskAssessments.id, input.id),
      eq(aiRiskAssessments.organizationId, organizationId),
    ));
    return { success: true };
  }),

  summary: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { total: 0, byLevel: {}, byCategory: {}, byStatus: {}, avgRiskScore: 0, openCritical: 0 };
    const all = await db.select().from(aiRiskAssessments).where(eq(
      aiRiskAssessments.organizationId,
      organizationIdFor(ctx.user),
    ));
    const byLevel = all.reduce((acc, r) => { acc[r.level] = (acc[r.level] ?? 0) + 1; return acc; }, {} as Record<string, number>);
    const byCategory = all.reduce((acc, r) => { acc[r.category] = (acc[r.category] ?? 0) + 1; return acc; }, {} as Record<string, number>);
    const byStatus = all.reduce((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; }, {} as Record<string, number>);
    const avgRiskScore = all.length > 0 ? Math.round(all.reduce((sum, r) => sum + (r.riskScore ?? 0), 0) / all.length) : 0;
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

// ─── Compliance/readiness ──────────────────────────────────────────────────────
const complianceRouter = router({
  list: protectedProcedure.input(z.object({
    modelId: z.number().int().positive().optional(),
    framework: z.enum(FRAMEWORKS).optional(),
    status: z.string().optional(),
  }).optional()).query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const conditions = [eq(aiComplianceChecks.organizationId, organizationIdFor(ctx.user))];
    if (input?.modelId !== undefined) conditions.push(eq(aiComplianceChecks.modelId, input.modelId));
    if (input?.framework) conditions.push(eq(aiComplianceChecks.framework, input.framework));
    if (input?.status) conditions.push(eq(aiComplianceChecks.status, input.status));
    return db.select().from(aiComplianceChecks).where(and(...conditions)).orderBy(desc(aiComplianceChecks.checkedAt));
  }),

  upsert: protectedProcedure.input(z.object({
    modelId: z.number().int().positive().optional(),
    modelName: z.string().min(1),
    framework: z.enum(FRAMEWORKS),
    checkName: z.string().min(1),
    description: z.string().optional(),
    passed: z.boolean(),
    evidence: z.string().optional(),
    notes: z.string().optional(),
    nextReviewAt: z.date().optional(),
    ruleVersion: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const organizationId = organizationIdFor(ctx.user);
    const model = await ensureModelIfProvided(db, input.modelId, organizationId);
    const evidence = trimOrUndefined(input.evidence);
    if (input.passed && !evidence) badRequest("Uma afirmação de passed exige evidência.");
    const modelName = model?.name ?? input.modelName;
    const existing = await findPendingCompliance(db, organizationId, input.modelId, modelName, input.framework, input.checkName);
    const values: InsertAiComplianceCheck = {
      organizationId,
      modelId: input.modelId,
      modelName,
      framework: input.framework,
      checkName: input.checkName,
      description: input.description,
      passed: input.passed,
      evidence: evidence ?? null,
      notes: input.notes,
      checkedById: ctx.user.id,
      status: "pending_review",
      reviewerId: null,
      reviewedAt: null,
      reviewNotes: null,
      ruleVersion: input.ruleVersion ?? "manual-v1",
      automated: false,
      evidenceVerified: false,
      checkedAt: new Date(),
      nextReviewAt: input.nextReviewAt,
    };
    if (existing) {
      const [updated] = await db.update(aiComplianceChecks).set(values).where(and(
        eq(aiComplianceChecks.id, existing.id),
        eq(aiComplianceChecks.organizationId, organizationId),
      )).returning();
      return updated;
    }
    const [created] = await db.insert(aiComplianceChecks).values(values).returning();
    return created;
  }),

  review: protectedProcedure.input(z.object({
    id: z.number().int().positive(),
    status: z.enum(COMPLIANCE_FINAL_STATUSES),
    reviewNotes: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    if (!isReviewer(ctx.user)) forbidden("Apenas Admin ou Data Steward pode revisar evidência.");
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const organizationId = organizationIdFor(ctx.user);
    const [check] = await db.select().from(aiComplianceChecks).where(and(
      eq(aiComplianceChecks.id, input.id),
      eq(aiComplianceChecks.organizationId, organizationId),
    ));
    if (!check) notFound("Checklist não encontrado nesta organização.");
    if (check.checkedById === ctx.user.id) forbidden("O revisor deve ser diferente de checkedById.");
    if (input.status === "passed" && !trimOrUndefined(check.evidence ?? undefined)) {
      badRequest("Não é possível revisar como passed sem evidência.");
    }
    if (input.status === "not_applicable" && !trimOrUndefined(input.reviewNotes)) {
      badRequest("Uma decisão not_applicable exige justificativa.");
    }
    const [reviewed] = await db.update(aiComplianceChecks).set({
      status: input.status,
      passed: input.status === "passed",
      reviewerId: ctx.user.id,
      reviewedAt: new Date(),
      reviewNotes: trimOrUndefined(input.reviewNotes) ?? null,
      evidenceVerified: input.status === "passed",
    }).where(and(
      eq(aiComplianceChecks.id, input.id),
      eq(aiComplianceChecks.organizationId, organizationId),
    )).returning();
    return reviewed;
  }),

  automatedEvaluate: protectedProcedure.input(z.object({
    modelId: z.number().int().positive().optional(),
    modelName: z.string().min(1).optional(),
    framework: z.enum(FRAMEWORKS),
    ruleVersion: z.string().min(1).default("presence-only-v1"),
    checks: z.array(z.object({
      checkName: z.string().min(1),
      description: z.string().optional(),
      evidencePresent: z.boolean(),
    })).optional().default([]),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const organizationId = organizationIdFor(ctx.user);
    const model = await ensureModelIfProvided(db, input.modelId, organizationId);
    const modelName = model?.name ?? input.modelName;
    if (!modelName) badRequest("Informe modelId ou modelName para executar a avaliação.");

    let checks = input.checks;
    if (checks.length === 0) {
      const existing = await db.select().from(aiComplianceChecks).where(and(
        eq(aiComplianceChecks.organizationId, organizationId),
        eq(aiComplianceChecks.framework, input.framework),
        input.modelId === undefined ? eq(aiComplianceChecks.modelName, modelName) : eq(aiComplianceChecks.modelId, input.modelId),
      ));
      checks = existing.map(check => ({
        checkName: check.checkName,
        description: check.description ?? undefined,
        evidencePresent: Boolean(trimOrUndefined(check.evidence ?? undefined)),
      }));
    }
    if (checks.length === 0) badRequest("Nenhum item para avaliar neste framework.");

    const results = [];
    for (const item of checks) {
      const existing = await findPendingCompliance(db, organizationId, input.modelId, modelName, input.framework, item.checkName);
      const values: InsertAiComplianceCheck = {
        organizationId,
        modelId: input.modelId,
        modelName,
        framework: input.framework,
        checkName: item.checkName,
        description: item.description,
        // Apenas o resultado de presença é armazenado; nenhum conteúdo de evidência é copiado.
        passed: item.evidencePresent,
        evidence: item.evidencePresent ? "presence_only" : null,
        checkedById: ctx.user.id,
        status: item.evidencePresent ? "pending_review" : "evidence_missing",
        reviewerId: null,
        reviewedAt: null,
        reviewNotes: null,
        ruleVersion: input.ruleVersion,
        automated: true,
        evidenceVerified: false,
        checkedAt: new Date(),
      };
      if (existing) {
        const [updated] = await db.update(aiComplianceChecks).set(values).where(and(
          eq(aiComplianceChecks.id, existing.id),
          eq(aiComplianceChecks.organizationId, organizationId),
        )).returning();
        results.push(updated);
      } else {
        const [created] = await db.insert(aiComplianceChecks).values(values).returning();
        results.push(created);
      }
    }
    const overallStatus = results.every(item => item.status === "evidence_missing") ? "evidence_missing" : "pending_review";
    return {
      framework: input.framework,
      modelName,
      items: results,
      status: overallStatus,
      automated: true,
      certification: false,
      message: overallStatus === "evidence_missing"
        ? "Nenhuma evidência foi indicada; readiness não pode ser concluída e não é certificação."
        : "Avaliação automatizada de presença de evidência; não é certificação e aguarda revisão humana.",
    };
  }),

  scoreByModel: protectedProcedure.input(z.object({
    modelId: z.number().int().positive().optional(),
    modelName: z.string().min(1).optional(),
  }).refine(value => value.modelId !== undefined || value.modelName !== undefined, {
    message: "Informe modelId ou modelName.",
  })).query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const organizationId = organizationIdFor(ctx.user);
    if (input.modelId !== undefined) await modelInTenant(db, input.modelId, organizationId);
    const checks = await db.select().from(aiComplianceChecks).where(and(
      eq(aiComplianceChecks.organizationId, organizationId),
      input.modelId !== undefined ? eq(aiComplianceChecks.modelId, input.modelId) : eq(aiComplianceChecks.modelName, input.modelName!),
    ));
    return FRAMEWORKS.map(framework => {
      const frameworkChecks = checks.filter(check => check.framework === framework);
      const reviewed = frameworkChecks.filter(check =>
        (check.status === "passed" || check.status === "failed") && check.reviewedAt !== null && check.reviewerId !== null,
      );
      const pending = frameworkChecks.filter(check =>
        !((check.status === "passed" || check.status === "failed") && check.reviewedAt !== null && check.reviewerId !== null) &&
        check.status !== "not_applicable",
      ).length;
      const notApplicable = frameworkChecks.filter(check => check.status === "not_applicable").length;
      const passed = reviewed.filter(check => check.status === "passed").length;
      const failed = reviewed.filter(check => check.status === "failed").length;
      const eligible = reviewed.length + pending;
      return {
        framework,
        passed,
        failed,
        reviewedCount: reviewed.length,
        pendingCount: pending,
        notApplicableCount: notApplicable,
        total: reviewed.length,
        score: reviewed.length > 0 ? Math.round((passed / reviewed.length) * 100) : 0,
        coverage: eligible > 0 ? Math.round((reviewed.length / eligible) * 100) : 0,
        flags: {
          hasPendingReview: pending > 0,
          hasNotApplicable: notApplicable > 0,
          isCertification: false,
        },
        text: "Readiness baseada apenas em checks revisados; não é certificação nem parecer jurídico.",
      };
    });
  }),
});

// ─── Risk history ──────────────────────────────────────────────────────────────
const historyRouter = router({
  byModel: protectedProcedure.input(z.object({
    modelName: z.string().min(1),
    limit: z.number().int().min(1).max(100).default(12),
  })).query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(aiRiskHistory).where(and(
      eq(aiRiskHistory.organizationId, organizationIdFor(ctx.user)),
      eq(aiRiskHistory.modelName, input.modelName),
    )).orderBy(desc(aiRiskHistory.recordedAt)).limit(input.limit);
  }),
});

async function snapshotRiskHistory(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  organizationId: number,
  modelId: number | undefined,
  modelName: string,
) {
  const risks = await db.select().from(aiRiskAssessments).where(and(
    eq(aiRiskAssessments.organizationId, organizationId),
    modelId !== undefined ? eq(aiRiskAssessments.modelId, modelId) : eq(aiRiskAssessments.modelName, modelName),
  ));
  const openCount = risks.filter(r => r.status === "aberto").length;
  const criticalCount = risks.filter(r => r.level === "critico").length;
  const riskScore = risks.length > 0 ? Math.round(risks.reduce((sum, r) => sum + (r.riskScore ?? 0), 0) / risks.length) : 0;
  await db.insert(aiRiskHistory).values({ organizationId, modelId, modelName, riskScore, openCount, criticalCount });
}

// ─── Fairness: somente contagens agregadas, sujeitas a revisão ──────────────────
const fairnessGroupInput = z.object({
  // Formato restrito a códigos sem espaços/e-mail; a aplicação não recebe linhas, nomes ou PII.
  code: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "Use um código pseudônimo sem espaços, e-mail ou PII"),
  sampleSize: z.number().int().positive(),
  positivePredictionCount: z.number().int().min(0),
  actualPositiveCount: z.number().int().min(0).optional(),
  truePositiveCount: z.number().int().min(0).optional(),
});

const fairnessRouter = router({
  list: protectedProcedure.input(z.object({
    modelId: z.number().int().positive().optional(),
    status: z.enum(["pending_review", "approved", "rejected", "needs_changes"]).optional(),
  }).optional()).query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const conditions = [eq(aiFairnessAssessments.organizationId, organizationIdFor(ctx.user))];
    if (input?.modelId !== undefined) conditions.push(eq(aiFairnessAssessments.modelId, input.modelId));
    if (input?.status) conditions.push(eq(aiFairnessAssessments.status, input.status));
    return db.select().from(aiFairnessAssessments).where(and(...conditions)).orderBy(desc(aiFairnessAssessments.createdAt));
  }),

  evaluate: protectedProcedure.input(z.object({
    modelId: z.number().int().positive().optional(),
    modelName: z.string().min(1).optional(),
    modelVersion: z.string().min(1).optional(),
    datasetName: z.string().min(1),
    datasetVersion: z.string().min(1),
    protectedAttribute: z.string().min(1),
    decisionThreshold: z.number().min(0).max(1).optional(),
    minimumGroupSize: z.number().int().positive().default(20),
    groups: z.array(fairnessGroupInput).min(2),
    methodology: z.string().min(1),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const organizationId = organizationIdFor(ctx.user);
    const model = await ensureModelIfProvided(db, input.modelId, organizationId);
    const modelName = model?.name ?? input.modelName;
    const modelVersion = input.modelVersion ?? model?.version;
    if (!modelName || !modelVersion) badRequest("Informe modelo e versão do modelo.");
    if (new Set(input.groups.map(group => group.code)).size !== input.groups.length) {
      badRequest("Os códigos pseudônimos dos grupos devem ser únicos.");
    }
    const normalizedGroups = input.groups.map(group => {
      if (group.positivePredictionCount > group.sampleSize) badRequest(`positivePredictionCount inválido para ${group.code}.`);
      if (group.actualPositiveCount !== undefined && group.actualPositiveCount > group.sampleSize) {
        badRequest(`actualPositiveCount inválido para ${group.code}.`);
      }
      if ((group.actualPositiveCount === undefined) !== (group.truePositiveCount === undefined)) {
        badRequest("actualPositiveCount e truePositiveCount devem ser informados juntos.");
      }
      if (group.truePositiveCount !== undefined && (
        group.actualPositiveCount === undefined ||
        group.truePositiveCount > group.actualPositiveCount ||
        group.truePositiveCount > group.positivePredictionCount
      )) {
        badRequest(`truePositiveCount inválido para ${group.code}.`);
      }
      return group;
    });
    const { groups, metrics } = calculateFairnessMetrics(normalizedGroups);
    const methodology = input.methodology.trim();
    const [created] = await db.insert(aiFairnessAssessments).values({
      organizationId,
      modelId: input.modelId,
      modelName,
      modelVersion,
      datasetName: input.datasetName,
      datasetVersion: input.datasetVersion,
      protectedAttribute: input.protectedAttribute,
      decisionThreshold: input.decisionThreshold,
      minimumGroupSize: input.minimumGroupSize,
      groups,
      metrics,
      methodology,
      status: "pending_review",
      createdById: ctx.user.id,
    }).returning();
    return {
      ...created,
      awaitingReview: true,
      universalFairness: false,
      message: "Métricas contextuais de fairness calculadas sobre contagens agregadas; aguardam avaliação humana.",
    };
  }),

  review: protectedProcedure.input(z.object({
    id: z.number().int().positive(),
    decision: z.enum(["approved", "rejected", "needs_changes"]),
    reviewNotes: z.string().min(1),
  })).mutation(async ({ input, ctx }) => {
    if (!isReviewer(ctx.user)) forbidden("Apenas Admin ou Data Steward pode revisar fairness.");
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const organizationId = organizationIdFor(ctx.user);
    const [assessment] = await db.select().from(aiFairnessAssessments).where(and(
      eq(aiFairnessAssessments.id, input.id),
      eq(aiFairnessAssessments.organizationId, organizationId),
    ));
    if (!assessment) notFound("Avaliação de fairness não encontrada nesta organização.");
    if (assessment.createdById === ctx.user.id) forbidden("O revisor deve ser diferente do autor da avaliação.");
    const [reviewed] = await db.update(aiFairnessAssessments).set({
      status: input.decision,
      reviewedById: ctx.user.id,
      reviewedAt: new Date(),
      reviewNotes: input.reviewNotes.trim(),
    }).where(and(
      eq(aiFairnessAssessments.id, input.id),
      eq(aiFairnessAssessments.organizationId, organizationId),
    )).returning();
    return reviewed;
  }),
});

export const aiRiskRouter = router({
  assessments: assessmentsRouter,
  compliance: complianceRouter,
  history: historyRouter,
  fairness: fairnessRouter,
});
