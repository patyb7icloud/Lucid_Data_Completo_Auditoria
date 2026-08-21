/**
 * mlopsRouter.ts
 * Lacuna 1: Módulo MLOps/LLMOps — Registro, Monitoramento e Ciclo de Vida de Modelos
 */
import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { getDb } from "./db";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import {
  mlModels,
  mlModelMetrics,
  mlPredictionLogs,
  type InsertMlModel,
} from "../drizzle/schema";
import { databricksService } from "./services/databricks";

// ─── Models Router ────────────────────────────────────────────────────────────
const modelsRouter = router({
  list: publicProcedure
    .input(z.object({
      status: z.enum(["development", "staging", "production", "deprecated", "archived"]).optional(),
      modelType: z.enum(["classification", "regression", "nlp", "llm", "computer_vision", "clustering", "other"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [];
      if (input?.status) conditions.push(eq(mlModels.status, input.status));
      if (input?.modelType) conditions.push(eq(mlModels.modelType, input.modelType));
      return db
        .select()
        .from(mlModels)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(mlModels.updatedAt));
    }),

  byId: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [model] = await db
        .select()
        .from(mlModels)
        .where(eq(mlModels.id, input.id));
      return model ?? null;
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(256),
      version: z.string().default("1.0.0"),
      description: z.string().optional(),
      modelType: z.enum(["classification", "regression", "nlp", "llm", "computer_vision", "clustering", "other"]).default("classification"),
      framework: z.enum(["sklearn", "pytorch", "tensorflow", "xgboost", "lightgbm", "huggingface", "openai", "other"]).default("sklearn"),
      status: z.enum(["development", "staging", "production", "deprecated", "archived"]).default("development"),
      domainId: z.number().optional(),
      ownerName: z.string().optional(),
      accuracyScore: z.number().min(0).max(1).optional(),
      f1Score: z.number().min(0).max(1).optional(),
      aucScore: z.number().min(0).max(1).optional(),
      artifactUri: z.string().optional(),
      experimentId: z.string().optional(),
      runId: z.string().optional(),
      gitCommit: z.string().optional(),
      tags: z.array(z.string()).default([]),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const data: InsertMlModel = {
        ...input,
        ownerId: ctx.user.id,
        ownerName: input.ownerName ?? ctx.user.name ?? undefined,
        createdById: ctx.user.id,
      };
      const [created] = await db.insert(mlModels).values(data).returning();
      return created;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      version: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(["development", "staging", "production", "deprecated", "archived"]).optional(),
      accuracyScore: z.number().min(0).max(1).optional(),
      f1Score: z.number().min(0).max(1).optional(),
      aucScore: z.number().min(0).max(1).optional(),
      driftScore: z.number().min(0).max(1).optional(),
      driftStatus: z.enum(["ok", "warning", "critical"]).optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...data } = input;
      const [updated] = await db
        .update(mlModels)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(mlModels.id, id))
        .returning();
      return updated;
    }),

  getFeatures: protectedProcedure
    .input(z.object({
      name: z.string(),
      forceRefresh: z.boolean().optional()
    }))
    .query(async ({ input }) => {
      return await databricksService.getModelFeaturesAndDrift(input.name, input.forceRefresh);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(mlModels).where(eq(mlModels.id, input.id));
      return { success: true };
    }),

  promoteStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["development", "staging", "production", "deprecated", "archived"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const now = new Date();
      const extra: Record<string, unknown> = { updatedAt: now };
      if (input.status === "production") extra.deployedAt = now;
      if (input.status === "deprecated") extra.deprecatedAt = now;
      const [updated] = await db
        .update(mlModels)
        .set({ status: input.status, ...extra })
        .where(eq(mlModels.id, input.id))
        .returning();
      return updated;
    }),

  summary: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, byStatus: {}, byType: {}, driftWarning: 0, driftCritical: 0, inProduction: 0 };
    const all = await db.select().from(mlModels);
    const byStatus = all.reduce((acc, m) => {
      acc[m.status] = (acc[m.status] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const byType = all.reduce((acc, m) => {
      acc[m.modelType] = (acc[m.modelType] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return {
      total: all.length,
      byStatus,
      byType,
      driftWarning: all.filter(m => m.driftStatus === "warning").length,
      driftCritical: all.filter(m => m.driftStatus === "critical").length,
      inProduction: byStatus["production"] ?? 0,
    };
  }),
});

// ─── Metrics Router ───────────────────────────────────────────────────────────
const metricsRouter = router({
  byModel: publicProcedure
    .input(z.object({ modelId: z.number(), limit: z.number().default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(mlModelMetrics)
        .where(eq(mlModelMetrics.modelId, input.modelId))
        .orderBy(desc(mlModelMetrics.recordedAt))
        .limit(input.limit);
    }),

  record: protectedProcedure
    .input(z.object({
      modelId: z.number(),
      accuracy: z.number().optional(),
      f1Score: z.number().optional(),
      aucScore: z.number().optional(),
      driftScore: z.number().optional(),
      predictionCount: z.number().optional(),
      errorRate: z.number().optional(),
      latencyP99Ms: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [metric] = await db.insert(mlModelMetrics).values(input).returning();
      if (input.driftScore !== undefined) {
        const driftStatus =
          input.driftScore >= 0.7 ? "critical" :
          input.driftScore >= 0.4 ? "warning" : "ok";
        await db
          .update(mlModels)
          .set({ driftScore: input.driftScore, driftStatus, lastDriftCheck: new Date() })
          .where(eq(mlModels.id, input.modelId));
      }
      return metric;
    }),
});

// ─── Prediction Logs Router ───────────────────────────────────────────────────
const predictionLogsRouter = router({
  byModel: publicProcedure
    .input(z.object({ modelId: z.number(), limit: z.number().default(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(mlPredictionLogs)
        .where(eq(mlPredictionLogs.modelId, input.modelId))
        .orderBy(desc(mlPredictionLogs.createdAt))
        .limit(input.limit);
    }),

  flag: protectedProcedure
    .input(z.object({ id: z.number(), reason: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [updated] = await db
        .update(mlPredictionLogs)
        .set({ flagged: true, flagReason: input.reason })
        .where(eq(mlPredictionLogs.id, input.id))
        .returning();
      return updated;
    }),
});

// ─── FinOps Router (AI Consumption) ──────────────────────────────────────────
const finopsRouter = router({
  summary: publicProcedure.query(async () => {
    return {
      totalTokens: 1250000,
      estimatedCostUSD: 45.50,
      totalRequests: 850,
      activeAgents: 4,
    };
  }),
  byAgent: publicProcedure.query(async () => {
    return [
      { name: "Agente de RH", tokens: 450000, costUSD: 15.00 },
      { name: "Agente de Marketing", tokens: 600000, costUSD: 25.50 },
      { name: "Agente Financeiro", tokens: 150000, costUSD: 4.00 },
      { name: "Assistente de TI", tokens: 50000, costUSD: 1.00 },
    ];
  }),
  byUser: publicProcedure.query(async () => {
    return [
      { id: "U001", name: "Ana Clara", department: "Marketing", tokens: 320000, costUSD: 14.50 },
      { id: "U002", name: "Carlos Eduardo", department: "RH", tokens: 210000, costUSD: 7.20 },
      { id: "U003", name: "Mariana Silva", department: "Financeiro", tokens: 180000, costUSD: 5.80 },
      { id: "U004", name: "João Pedro", department: "TI", tokens: 110000, costUSD: 3.00 },
      { id: "U005", name: "Fernanda Costa", department: "Diretoria", tokens: 80000, costUSD: 2.50 },
    ];
  }),
  anomalies: publicProcedure.query(async () => {
    return [
      { id: 1, type: "spiking", message: "Pico de 150k tokens em 2h", agent: "Agente de Marketing", severity: "high", timestamp: new Date().toISOString() },
      { id: 2, type: "unusual_user", message: "Usuário do Financeiro acessou Agente de TI 50x", agent: "Assistente de TI", severity: "medium", timestamp: new Date(Date.now() - 86400000).toISOString() },
    ];
  }),
});

export const mlopsRouter = router({
  models: modelsRouter,
  metrics: metricsRouter,
  predictionLogs: predictionLogsRouter,
  finops: finopsRouter,
});
