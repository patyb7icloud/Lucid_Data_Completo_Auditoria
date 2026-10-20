/**
 * MLOps/LLMOps — registro, monitoramento e FinOps por organização.
 * O ledger de invocações é a única fonte para consumo LLM; prediction logs
 * históricos não são usados para estimar tokens ou faturamento.
 */
import { z } from "zod";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { adminProcedure, protectedProcedure, router, stewardProcedure } from "./_core/trpc";
import {
  llmInvocationLogs,
  mlModels,
  mlModelMetrics,
  mlPredictionLogs,
  type InsertMlModel,
} from "../drizzle/schema";
import { databricksService } from "./services/databricks";

const organizationIdFor = (ctx: { user: { organizationId?: number | null } }) => ctx.user.organizationId ?? 1;
const periodSchema = z.enum(["weekly", "monthly", "yearly"]);
const periodInput = z.object({ period: periodSchema }).optional();
type Period = z.infer<typeof periodSchema>;

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type LedgerRow = {
  operation: string;
  userId: number | null;
  status: string;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: string | number | null;
  billedCostUsd: string | number | null;
  createdAt: Date;
};

function tenantId(ctx: { user: { organizationId?: number | null } }): number {
  return organizationIdFor(ctx);
}

async function tenantModel(db: Db, modelId: number, organizationId: number) {
  const [model] = await db
    .select()
    .from(mlModels)
    .where(and(eq(mlModels.id, modelId), eq(mlModels.organizationId, organizationId)))
    .limit(1);
  if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "Modelo não encontrado." });
  return model;
}

async function tenantModelByName(db: Db, name: string, organizationId: number) {
  const [model] = await db
    .select({ id: mlModels.id })
    .from(mlModels)
    .where(and(eq(mlModels.name, name), eq(mlModels.organizationId, organizationId)))
    .limit(1);
  if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "Modelo não encontrado." });
  return model;
}

// ─── Models ────────────────────────────────────────────────────────────────────
const modelsRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["development", "staging", "production", "deprecated", "archived"]).optional(),
      modelType: z.enum(["classification", "regression", "nlp", "llm", "computer_vision", "clustering", "other"]).optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(mlModels.organizationId, tenantId(ctx))];
      if (input?.status) conditions.push(eq(mlModels.status, input.status));
      if (input?.modelType) conditions.push(eq(mlModels.modelType, input.modelType));
      return db.select().from(mlModels).where(and(...conditions)).orderBy(desc(mlModels.updatedAt));
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return null;
      const [model] = await db
        .select()
        .from(mlModels)
        .where(and(eq(mlModels.id, input.id), eq(mlModels.organizationId, tenantId(ctx))))
        .limit(1);
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
        organizationId: tenantId(ctx),
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
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await tenantModel(db, input.id, tenantId(ctx));
      const { id, ...data } = input;
      const [updated] = await db
        .update(mlModels)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(mlModels.id, id), eq(mlModels.organizationId, tenantId(ctx))))
        .returning();
      return updated;
    }),

  getFeatures: protectedProcedure
    .input(z.object({ name: z.string(), forceRefresh: z.boolean().optional() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      await tenantModelByName(db, input.name, tenantId(ctx));
      return databricksService.getModelFeaturesAndDrift(input.name, input.forceRefresh);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await tenantModel(db, input.id, tenantId(ctx));
      await db.delete(mlModels).where(and(eq(mlModels.id, input.id), eq(mlModels.organizationId, tenantId(ctx))));
      return { success: true };
    }),

  promoteStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["development", "staging", "production", "deprecated", "archived"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await tenantModel(db, input.id, tenantId(ctx));
      const now = new Date();
      const extra: Record<string, unknown> = { updatedAt: now };
      if (input.status === "production") extra.deployedAt = now;
      if (input.status === "deprecated") extra.deprecatedAt = now;
      const [updated] = await db
        .update(mlModels)
        .set({ status: input.status, ...extra })
        .where(and(eq(mlModels.id, input.id), eq(mlModels.organizationId, tenantId(ctx))))
        .returning();
      return updated;
    }),

  summary: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { total: 0, byStatus: {}, byType: {}, driftWarning: 0, driftCritical: 0, inProduction: 0 };
    const all = await db.select().from(mlModels).where(eq(mlModels.organizationId, tenantId(ctx)));
    const byStatus = all.reduce((acc, model) => {
      acc[model.status] = (acc[model.status] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const byType = all.reduce((acc, model) => {
      acc[model.modelType] = (acc[model.modelType] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return {
      total: all.length,
      byStatus,
      byType,
      driftWarning: all.filter(model => model.driftStatus === "warning").length,
      driftCritical: all.filter(model => model.driftStatus === "critical").length,
      inProduction: byStatus.production ?? 0,
    };
  }),
});

// ─── Metrics ───────────────────────────────────────────────────────────────────
const metricsRouter = router({
  byModel: protectedProcedure
    .input(z.object({ modelId: z.number(), limit: z.number().int().min(1).max(200).default(30) }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      await tenantModel(db, input.modelId, tenantId(ctx));
      return db
        .select()
        .from(mlModelMetrics)
        .where(and(eq(mlModelMetrics.modelId, input.modelId), eq(mlModelMetrics.organizationId, tenantId(ctx))))
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
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await tenantModel(db, input.modelId, tenantId(ctx));
      const [metric] = await db.insert(mlModelMetrics).values({ ...input, organizationId: tenantId(ctx) }).returning();
      if (input.driftScore !== undefined) {
        const driftStatus = input.driftScore >= 0.7 ? "critical" : input.driftScore >= 0.4 ? "warning" : "ok";
        await db
          .update(mlModels)
          .set({ driftScore: input.driftScore, driftStatus, lastDriftCheck: new Date() })
          .where(and(eq(mlModels.id, input.modelId), eq(mlModels.organizationId, tenantId(ctx))));
      }
      return metric;
    }),
});

// ─── Prediction logs ───────────────────────────────────────────────────────────
const predictionLogsRouter = router({
  byModel: protectedProcedure
    .input(z.object({ modelId: z.number(), limit: z.number().int().min(1).max(200).default(50) }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      await tenantModel(db, input.modelId, tenantId(ctx));
      return db
        .select()
        .from(mlPredictionLogs)
        .where(and(eq(mlPredictionLogs.modelId, input.modelId), eq(mlPredictionLogs.organizationId, tenantId(ctx))))
        .orderBy(desc(mlPredictionLogs.createdAt))
        .limit(input.limit);
    }),

  flag: protectedProcedure
    .input(z.object({ id: z.number(), reason: z.string().min(1).max(2000) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [updated] = await db
        .update(mlPredictionLogs)
        .set({ flagged: true, flagReason: input.reason })
        .where(and(eq(mlPredictionLogs.id, input.id), eq(mlPredictionLogs.organizationId, tenantId(ctx))))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Log de predição não encontrado." });
      return updated;
    }),
});

// ─── FinOps: sempre somente ledger LLM e somente roles privilegiadas ───────────
export function periodWindow(period: Period): { start: Date; end: Date } {
  const end = new Date();
  let start = new Date(end);
  if (period === "weekly") {
    start.setDate(start.getDate() - 7);
  } else if (period === "monthly") {
    start = new Date(end.getFullYear(), end.getMonth(), 1);
  } else {
    start = new Date(end.getFullYear(), 0, 1);
  }
  return { start, end };
}

async function ledgerRows(db: Db, organizationId: number, period: Period): Promise<LedgerRow[]> {
  const { start, end } = periodWindow(period);
  return db
    .select({
      operation: llmInvocationLogs.operation,
      userId: llmInvocationLogs.userId,
      status: llmInvocationLogs.status,
      inputTokens: llmInvocationLogs.inputTokens,
      outputTokens: llmInvocationLogs.outputTokens,
      estimatedCostUsd: llmInvocationLogs.estimatedCostUsd,
      billedCostUsd: llmInvocationLogs.billedCostUsd,
      createdAt: llmInvocationLogs.createdAt,
    })
    .from(llmInvocationLogs)
    .where(and(eq(llmInvocationLogs.organizationId, organizationId), gte(llmInvocationLogs.createdAt, start), lt(llmInvocationLogs.createdAt, end))) as unknown as Promise<LedgerRow[]>;
}

function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function rowTokens(row: LedgerRow): number | null {
  const input = numeric(row.inputTokens);
  const output = numeric(row.outputTokens);
  return input === null || output === null ? null : input + output;
}

function nullableSum(values: unknown[]): number | null {
  const numbers = values.map(numeric).filter((value): value is number => value !== null);
  return numbers.length > 0 ? numbers.reduce((sum, value) => sum + value, 0) : null;
}

export function aggregateFinOpsRows(rows: LedgerRow[]) {
  const tokenRows = rows.map(rowTokens);
  const knownTokens = tokenRows.filter((value): value is number => value !== null);
  const operations = [...new Set(rows.map(row => row.operation))];
  const estimatedCostUSD = nullableSum(rows.map(row => row.estimatedCostUsd));
  const billedCostUSD = nullableSum(rows.map(row => row.billedCostUsd));
  return {
    inputTokens: nullableSum(rows.map(row => row.inputTokens)),
    outputTokens: nullableSum(rows.map(row => row.outputTokens)),
    totalTokens: knownTokens.length > 0 ? knownTokens.reduce((sum, value) => sum + value, 0) : null,
    unknownTokenRequests: rows.length - knownTokens.length,
    totalRequests: rows.length,
    successfulRequests: rows.filter(row => row.status === "success").length,
    failedRequests: rows.filter(row => row.status !== "success").length,
    activeAgents: operations.length,
    activeOperations: operations.length,
    operations,
    estimatedCostUSD,
    billedCostUSD,
    estimatedCostUsd: estimatedCostUSD,
    billedCostUsd: billedCostUSD,
  };
}

function groupedRows(rows: LedgerRow[], key: (row: LedgerRow) => string) {
  const groups = new Map<string, LedgerRow[]>();
  for (const row of rows) {
    const groupKey = key(row);
    const group = groups.get(groupKey) ?? [];
    group.push(row);
    groups.set(groupKey, group);
  }
  return groups;
}

const finopsRouter = router({
  summary: stewardProcedure
    .input(periodInput)
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      const period = input?.period ?? "monthly";
      if (!db) return { period, ...aggregateFinOpsRows([]) };
      return { period, ...aggregateFinOpsRows(await ledgerRows(db, tenantId(ctx), period)) };
    }),

  byAgent: stewardProcedure
    .input(periodInput)
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const period = input?.period ?? "monthly";
      return [...groupedRows(await ledgerRows(db, tenantId(ctx), period), row => row.operation)]
        .map(([operation, operationRows]) => {
          const values = aggregateFinOpsRows(operationRows);
          return {
            name: operation,
            operation,
            tokens: values.totalTokens,
            totalTokens: values.totalTokens,
            estimatedCostUSD: values.estimatedCostUSD,
            billedCostUSD: values.billedCostUSD,
            estimatedCostUsd: values.estimatedCostUsd,
            billedCostUsd: values.billedCostUsd,
            costUSD: values.estimatedCostUSD,
            totalRequests: values.totalRequests,
            successfulRequests: values.successfulRequests,
            failedRequests: values.failedRequests,
          };
        })
        .sort((a, b) => (b.totalTokens ?? -1) - (a.totalTokens ?? -1));
    }),

  byUser: adminProcedure
    .input(periodInput)
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const period = input?.period ?? "monthly";
      return [...groupedRows(await ledgerRows(db, tenantId(ctx), period), row => row.userId === null ? "background" : String(row.userId))]
        .map(([id, userRows]) => {
          const values = aggregateFinOpsRows(userRows);
          return {
            id,
            name: id === "background" ? "Background" : `Usuário ${id}`,
            department: "—",
            tokens: values.totalTokens,
            totalTokens: values.totalTokens,
            estimatedCostUSD: values.estimatedCostUSD,
            billedCostUSD: values.billedCostUSD,
            estimatedCostUsd: values.estimatedCostUsd,
            billedCostUsd: values.billedCostUsd,
            costUSD: values.estimatedCostUSD,
            totalRequests: values.totalRequests,
            successfulRequests: values.successfulRequests,
            failedRequests: values.failedRequests,
          };
        })
        .sort((a, b) => (b.totalTokens ?? -1) - (a.totalTokens ?? -1));
    }),

  anomalies: stewardProcedure
    .input(periodInput)
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await ledgerRows(db, tenantId(ctx), input?.period ?? "monthly");
      if (rows.length === 0) return [];

      const anomalies: Array<{ id: string; type: string; message: string; agent: string; severity: "high" | "medium"; timestamp: string }> = [];
      const buckets = new Map<string, { operation: string; tokens: number; timestamp: Date }>();
      for (const row of rows) {
        const tokens = rowTokens(row);
        if (tokens === null) continue;
        const hour = new Date(row.createdAt);
        hour.setMinutes(0, 0, 0);
        const key = `${row.operation}:${hour.toISOString()}`;
        const bucket = buckets.get(key) ?? { operation: row.operation, tokens: 0, timestamp: hour };
        bucket.tokens += tokens;
        buckets.set(key, bucket);
      }
      const bucketValues = [...buckets.values()];
      if (bucketValues.length > 1) {
        const average = bucketValues.reduce((sum, bucket) => sum + bucket.tokens, 0) / bucketValues.length;
        for (const bucket of bucketValues) {
          if (bucket.tokens >= average * 3 && bucket.tokens > 0) {
            anomalies.push({
              id: `spiking:${bucket.operation}:${bucket.timestamp.toISOString()}`,
              type: "spiking",
              message: `Pico de ${Math.round(bucket.tokens).toLocaleString("pt-BR")} tokens na operação ${bucket.operation}.`,
              agent: bucket.operation,
              severity: "high",
              timestamp: bucket.timestamp.toISOString(),
            });
          }
        }
      }
      for (const [operation, operationRows] of groupedRows(rows, row => row.operation)) {
        const failures = operationRows.filter(row => row.status !== "success").length;
        if (operationRows.length >= 3 && failures / operationRows.length >= 0.5) {
          const latest = operationRows.reduce((current, row) => new Date(row.createdAt) > new Date(current.createdAt) ? row : current);
          anomalies.push({
            id: `failures:${operation}:${new Date(latest.createdAt).toISOString()}`,
            type: "failure_rate",
            message: `Taxa de falha de ${Math.round(failures / operationRows.length * 100)}% na operação ${operation}.`,
            agent: operation,
            severity: "medium",
            timestamp: new Date(latest.createdAt).toISOString(),
          });
        }
      }
      return anomalies;
    }),
});

export const mlopsRouter = router({
  models: modelsRouter,
  metrics: metricsRouter,
  predictionLogs: predictionLogsRouter,
  finops: finopsRouter,
});
