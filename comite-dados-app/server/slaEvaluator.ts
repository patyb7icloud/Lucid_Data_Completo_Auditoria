import { randomUUID } from "node:crypto";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  accessRequests,
  auditLog,
  dataAssets,
  slaConfigs,
  slaEvaluationRuns,
  slaViolations,
} from "../drizzle/schema";

const DAY_MS = 24 * 60 * 60 * 1000;
const ADVISORY_LOCK_NAMESPACE = 57124;

type EntityType = "asset" | "access_request";
type ViolationType = "stale_data" | "low_quality" | "slow_access_response";
type SlaEntityType = "global" | "domain" | "asset";

export interface EvaluateSlaInput {
  organizationId: number;
  source: "manual" | "scheduler";
  actorId?: number;
  dryRun?: boolean;
  now?: Date;
}

export interface SlaCounters {
  evaluated: number;
  opened: number;
  updated: number;
  resolved: number;
  skipped: number;
  errors: number;
}

export interface EvaluateSlaResult {
  runId: string;
  status: "completed" | "skipped" | "failed";
  counters: SlaCounters;
  notifications: {
    sent: false;
    pending: true;
    message: string;
  };
}

export interface SlaConfigLike {
  id: number;
  organizationId?: number | null;
  entityType: SlaEntityType | string;
  entityId?: number | null;
  maxUpdateDays?: number | null;
  minQualityScore?: number | null;
  maxAccessResponseDays?: number | null;
  active?: boolean | null;
}

export interface AssetSlaLike {
  id: number;
  organizationId?: number | null;
  domainId?: number | null;
  qualityScore?: number | null;
  lastSyncAt?: Date | string | null;
  status?: string | null;
}

export interface AccessRequestSlaLike {
  id: number;
  organizationId?: number | null;
  assetId: number;
  status?: string | null;
  createdAt?: Date | string | null;
  ownerApprovedAt?: Date | string | null;
}

export interface SlaObservation {
  violationType: ViolationType;
  breach: boolean;
  daysOverdue: number;
  rootCause: string;
  details: Record<string, unknown>;
}

export interface SlaConfigResolution {
  config: SlaConfigLike | null;
  conflict: boolean;
  scope?: string;
  configIds?: number[];
}

function asDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function validNow(now: Date): Date {
  const normalized = asDate(now);
  if (!normalized) throw new Error("now must be a valid date");
  return normalized;
}

/**
 * Calcula atraso por tempo decorrido em UTC. O limite é inclusivo: exatamente
 * no limite não há breach; um milissegundo além do limite já é uma ocorrência.
 */
export function calculateDaysOverdue(
  startedAt: Date | string | null | undefined,
  thresholdDays: number,
  now: Date,
): { breach: boolean; daysOverdue: number; elapsedDays: number | null } {
  const start = asDate(startedAt);
  const current = validNow(now);
  if (!Number.isFinite(thresholdDays) || thresholdDays < 0) {
    return { breach: false, daysOverdue: 0, elapsedDays: start ? 0 : null };
  }
  if (!start) return { breach: true, daysOverdue: 0, elapsedDays: null };

  const elapsedDays = (current.getTime() - start.getTime()) / DAY_MS;
  const over = Math.max(0, elapsedDays - thresholdDays);
  return {
    breach: elapsedDays > thresholdDays,
    daysOverdue: Math.ceil(over),
    elapsedDays,
  };
}

/**
 * Retorna a única configuração aplicável. Configurações ativas duplicadas no
 * mesmo escopo são um erro deliberado, nunca uma escolha por ordem de ID.
 */
export function resolveSlaConfig(
  configs: readonly SlaConfigLike[],
  assetId: number,
  domainId?: number | null,
): SlaConfigResolution {
  const active = configs.filter((config) =>
    config.active !== false &&
    (config.entityType === "global" || config.entityId != null),
  );
  const byScope = new Map<string, SlaConfigLike[]>();

  for (const config of active) {
    if (config.entityType !== "global" && config.entityType !== "domain" && config.entityType !== "asset") continue;
    const scopeId = config.entityType === "global" ? "*" : String(config.entityId ?? "__missing__");
    const key = `${config.entityType}:${scopeId}`;
    const entries = byScope.get(key) ?? [];
    entries.push(config);
    byScope.set(key, entries);
  }

  const candidates: Array<{ key: string; config: SlaConfigLike | null }> = [
    { key: `asset:${assetId}`, config: null },
    { key: `domain:${domainId ?? "__missing__"}`, config: null },
    { key: "global:*", config: null },
  ];

  for (const candidate of candidates) {
    const entries = byScope.get(candidate.key) ?? [];
    if (entries.length > 1) {
      return {
        config: null,
        conflict: true,
        scope: candidate.key,
        configIds: entries.map((entry) => entry.id),
      };
    }
    if (entries.length === 1) return { config: entries[0], conflict: false, scope: candidate.key };
  }

  return { config: null, conflict: false };
}

export function evaluateAssetSla(
  asset: AssetSlaLike,
  config: SlaConfigLike,
  now: Date,
): SlaObservation[] {
  const current = validNow(now);
  const observations: SlaObservation[] = [];

  if (config.maxUpdateDays != null) {
    const timing = calculateDaysOverdue(asset.lastSyncAt, config.maxUpdateDays, current);
    observations.push({
      violationType: "stale_data",
      breach: timing.breach,
      daysOverdue: timing.daysOverdue,
      rootCause: "stale_data",
      details: asset.lastSyncAt == null
        ? {
            rule: "freshness",
            evidence: "missing_lastSyncAt",
            thresholdDays: config.maxUpdateDays,
          }
        : {
            rule: "freshness",
            thresholdDays: config.maxUpdateDays,
            elapsedDays: timing.elapsedDays,
          },
    });
  }

  if (config.minQualityScore != null) {
    const score = asset.qualityScore;
    const missing = score == null;
    const breach = missing || (score != null && score < config.minQualityScore);
    observations.push({
      violationType: "low_quality",
      breach,
      daysOverdue: 0,
      rootCause: "low_quality",
      details: missing
        ? {
            rule: "quality",
            evidence: "missing_qualityScore",
            thresholdScore: config.minQualityScore,
          }
        : {
            rule: "quality",
            score,
            thresholdScore: config.minQualityScore,
          },
    });
  }

  return observations;
}

const TERMINAL_ACCESS_STATUSES = new Set(["aprovado", "rejeitado_owner", "rejeitado_steward"]);

export function evaluateAccessRequestSla(
  request: AccessRequestSlaLike,
  config: SlaConfigLike,
  now: Date,
): SlaObservation[] {
  if (TERMINAL_ACCESS_STATUSES.has(String(request.status))) return [];
  if (config.maxAccessResponseDays == null) return [];

  const status = String(request.status ?? "");
  const isOwnerPending = status === "pendente_owner";
  const isStewardPending = status === "pendente_steward";
  if (!isOwnerPending && !isStewardPending) return [];

  const startedAt = isStewardPending ? (request.ownerApprovedAt ?? request.createdAt) : request.createdAt;
  const timing = calculateDaysOverdue(startedAt, config.maxAccessResponseDays, now);
  const missingEvidence = asDate(startedAt) == null;
  return [
    {
      violationType: "slow_access_response",
      breach: timing.breach,
      daysOverdue: timing.daysOverdue,
      rootCause: "slow_access_response",
      details: missingEvidence
        ? {
            rule: "access_response",
            status,
            evidence: isStewardPending ? "missing_ownerApprovedAt_and_createdAt" : "missing_createdAt",
            thresholdDays: config.maxAccessResponseDays,
          }
        : {
            rule: "access_response",
            status,
            clockStartedAt: isStewardPending && request.ownerApprovedAt ? "ownerApprovedAt" : "createdAt",
            thresholdDays: config.maxAccessResponseDays,
            elapsedDays: timing.elapsedDays,
          },
    },
  ];
}

function emptyCounters(): SlaCounters {
  return { evaluated: 0, opened: 0, updated: 0, resolved: 0, skipped: 0, errors: 0 };
}

function notificationInfo(): EvaluateSlaResult["notifications"] {
  return {
    sent: false,
    pending: true,
    message: "Notificações por e-mail/webhook ainda são uma etapa posterior; nenhuma foi enviada.",
  };
}

function compositeKey(
  configId: number,
  entityType: EntityType,
  entityId: number,
  violationType: ViolationType,
): string {
  return `${configId}:${entityType}:${entityId}:${violationType}`;
}

function entityKey(entityType: EntityType, entityId: number): string {
  return `${entityType}:${entityId}`;
}

function lockAcquired(result: unknown): boolean {
  const rows = Array.isArray(result)
    ? result
    : (result as { rows?: unknown[] } | null | undefined)?.rows ?? [];
  const first = (rows[0] ?? {}) as Record<string, unknown>;
  const value = first.locked ?? first.pg_try_advisory_xact_lock;
  return value === true || value === "t" || value === 1 || value === "1";
}

function activeViolationStatus(status: unknown): boolean {
  return status === "active" || status === "investigating" || status == null;
}

async function insertAudit(
  tx: any,
  input: {
    organizationId: number;
    actorId?: number;
    action: "create" | "update" | "view";
    entity: string;
    entityId?: number;
    details: Record<string, unknown>;
  },
): Promise<void> {
  await tx.insert(auditLog).values({
    organizationId: input.organizationId,
    userId: input.actorId ?? null,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? null,
    details: input.details,
  });
}

function isUniqueConflict(error: unknown): boolean {
  const candidate = error as { code?: string; cause?: { code?: string } } | null;
  return candidate?.code === "23505" || candidate?.cause?.code === "23505";
}

interface EvaluationContext {
  tx: any;
  organizationId: number;
  actorId?: number;
  now: Date;
  dryRun: boolean;
  counters: SlaCounters;
  activeByKey: Map<string, any>;
  applicableConfigByEntity: Map<string, number | null>;
  expectedActiveKeys: Set<string>;
  blockedEntities: Set<string>;
}

async function refreshOrOpen(ctx: EvaluationContext, entityType: EntityType, entityId: number, config: SlaConfigLike, observation: SlaObservation): Promise<void> {
  const key = compositeKey(config.id, entityType, entityId, observation.violationType);
  if (observation.breach) {
    ctx.expectedActiveKeys.add(key);
    const existing = ctx.activeByKey.get(key);
    if (existing) {
      ctx.counters.updated += 1;
      if (!ctx.dryRun) {
        await ctx.tx.update(slaViolations)
          .set({ daysOverdue: observation.daysOverdue, details: observation.details, rootCause: observation.rootCause })
          .where(and(eq(slaViolations.id, existing.id), eq(slaViolations.organizationId, ctx.organizationId)));
        await insertAudit(ctx.tx, {
          organizationId: ctx.organizationId,
          actorId: ctx.actorId,
          action: "update",
          entity: "sla_violation",
          entityId: existing.id,
          details: { operation: "refresh", violationType: observation.violationType },
        });
      }
      return;
    }

    if (ctx.dryRun) {
      ctx.counters.opened += 1;
      return;
    }

    const values = {
      organizationId: ctx.organizationId,
      slaConfigId: config.id,
      entityType,
      entityId,
      violationType: observation.violationType,
      daysOverdue: observation.daysOverdue,
      details: observation.details,
      status: "active",
      rootCause: observation.rootCause,
      detectedAt: ctx.now,
    };
    let inserted: any[] = [];
    try {
      inserted = await ctx.tx.insert(slaViolations).values(values).onConflictDoNothing().returning();
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
    }
    const row = inserted[0] ?? (await ctx.tx.select().from(slaViolations).where(and(
      eq(slaViolations.organizationId, ctx.organizationId),
      eq(slaViolations.slaConfigId, config.id),
      eq(slaViolations.entityType, entityType),
      eq(slaViolations.entityId, entityId),
      eq(slaViolations.violationType, observation.violationType),
      eq(slaViolations.status, "active"),
    )).limit(1))[0];
    if (row) ctx.activeByKey.set(key, row);
    if (inserted[0]) {
      ctx.counters.opened += 1;
      await insertAudit(ctx.tx, {
        organizationId: ctx.organizationId,
        actorId: ctx.actorId,
        action: "create",
        entity: "sla_violation",
        entityId: inserted[0].id,
        details: { operation: "open", violationType: observation.violationType },
      });
    } else if (row) {
      // The partial unique index won a race with this evaluator. Treat the
      // existing row as an update rather than reporting a false opening.
      ctx.counters.updated += 1;
      await ctx.tx.update(slaViolations)
        .set({ daysOverdue: observation.daysOverdue, details: observation.details, rootCause: observation.rootCause })
        .where(and(eq(slaViolations.id, row.id), eq(slaViolations.organizationId, ctx.organizationId)));
    }
    return;
  }

  const existing = ctx.activeByKey.get(key);
  if (!existing) return;
  if (!ctx.dryRun) {
    await ctx.tx.update(slaViolations)
      .set({ status: "resolved", resolvedAt: ctx.now, details: { resolutionReason: "breach_ceased" } })
      .where(and(eq(slaViolations.id, existing.id), eq(slaViolations.organizationId, ctx.organizationId)));
    await insertAudit(ctx.tx, {
      organizationId: ctx.organizationId,
      actorId: ctx.actorId,
      action: "update",
      entity: "sla_violation",
      entityId: existing.id,
      details: { operation: "resolve", resolutionReason: "breach_ceased", violationType: observation.violationType },
    });
  }
  ctx.activeByKey.delete(key);
  ctx.counters.resolved += 1;
}

async function resolveObsoleteViolations(ctx: EvaluationContext): Promise<void> {
  for (const [key, violation] of ctx.activeByKey) {
    if (!activeViolationStatus(violation.status)) continue;
    const entity = entityKey(violation.entityType as EntityType, violation.entityId);
    if (ctx.blockedEntities.has(entity)) continue;
    const applicableConfigId = ctx.applicableConfigByEntity.get(entity);
    const configChanged = applicableConfigId !== violation.slaConfigId;
    const breachStopped = !ctx.expectedActiveKeys.has(key);
    if (!configChanged && !breachStopped) continue;

    if (!ctx.dryRun) {
      await ctx.tx.update(slaViolations)
        .set({ status: "resolved", resolvedAt: ctx.now, details: {
          resolutionReason: configChanged ? "configuration_no_longer_applies" : "breach_ceased",
        } })
        .where(and(eq(slaViolations.id, violation.id), eq(slaViolations.organizationId, ctx.organizationId)));
      await insertAudit(ctx.tx, {
        organizationId: ctx.organizationId,
        actorId: ctx.actorId,
        action: "update",
        entity: "sla_violation",
        entityId: violation.id,
        details: {
          operation: "resolve",
          resolutionReason: configChanged ? "configuration_no_longer_applies" : "breach_ceased",
          previousConfigId: violation.slaConfigId,
        },
      });
    }
    ctx.counters.resolved += 1;
    ctx.activeByKey.delete(key);
  }
}

function duplicateScopeKey(config: SlaConfigLike): string {
  return `${config.entityType}:${config.entityType === "global" ? "*" : String(config.entityId ?? "__missing__")}`;
}

async function reportConfigConflict(ctx: EvaluationContext, resolution: SlaConfigResolution, reported: Set<string>): Promise<void> {
  if (!resolution.conflict || !resolution.scope || reported.has(resolution.scope)) return;
  reported.add(resolution.scope);
  ctx.counters.errors += 1;
  await insertAudit(ctx.tx, {
    organizationId: ctx.organizationId,
    actorId: ctx.actorId,
    action: "view",
    entity: "sla_config",
    details: {
      operation: "configuration_conflict",
      scope: resolution.scope,
      configIds: resolution.configIds ?? [],
    },
  });
}

async function runEvaluationInTransaction(
  tx: any,
  input: Required<Pick<EvaluateSlaInput, "organizationId" | "source">> & Pick<EvaluateSlaInput, "actorId" | "dryRun" | "now">,
  runId: string,
): Promise<EvaluateSlaResult> {
  const now = validNow(input.now ?? new Date());
  const counters = emptyCounters();
  await tx.insert(slaEvaluationRuns).values({
    organizationId: input.organizationId,
    runId,
    source: input.source,
    status: "running",
    startedAt: now,
    actorId: input.actorId ?? null,
    details: { dryRun: Boolean(input.dryRun) },
  });
  await insertAudit(tx, {
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "create",
    entity: "sla_evaluation_run",
    details: { runId, source: input.source, operation: "started", dryRun: Boolean(input.dryRun) },
  });

  const lockResult = await tx.execute(sql`select pg_try_advisory_xact_lock(${input.organizationId}, ${ADVISORY_LOCK_NAMESPACE}) as locked`);
  if (!lockAcquired(lockResult)) {
    const skipped: EvaluateSlaResult = { runId, status: "skipped", counters, notifications: notificationInfo() };
    await tx.update(slaEvaluationRuns).set({ status: "skipped", finishedAt: now, details: { ...counters, reason: "another_evaluation_is_running" } }).where(eq(slaEvaluationRuns.runId, runId));
    await insertAudit(tx, {
      organizationId: input.organizationId,
      actorId: input.actorId,
      action: "update",
      entity: "sla_evaluation_run",
      details: { runId, operation: "skipped", reason: "another_evaluation_is_running" },
    });
    return skipped;
  }

  const [configs, assets, requests, activeViolations] = await Promise.all([
    tx.select().from(slaConfigs).where(eq(slaConfigs.organizationId, input.organizationId)),
    tx.select().from(dataAssets).where(eq(dataAssets.organizationId, input.organizationId)),
    tx.select().from(accessRequests).where(eq(accessRequests.organizationId, input.organizationId)),
    tx.select().from(slaViolations).where(and(
      eq(slaViolations.organizationId, input.organizationId),
      or(eq(slaViolations.status, "active"), eq(slaViolations.status, "investigating"), isNull(slaViolations.status)),
    )),
  ]);

  const activeConfigRows = (configs as SlaConfigLike[]).filter((config) =>
    config.active !== false &&
    (config.entityType === "global" || config.entityId != null),
  );
  const configsByScope = new Map<string, SlaConfigLike[]>();
  for (const config of activeConfigRows) {
    const scope = duplicateScopeKey(config);
    const entries = configsByScope.get(scope) ?? [];
    entries.push(config);
    configsByScope.set(scope, entries);
  }

  const activeByKey = new Map<string, any>();
  for (const violation of activeViolations as any[]) {
    activeByKey.set(compositeKey(violation.slaConfigId, violation.entityType, violation.entityId, violation.violationType), violation);
  }
  const ctx: EvaluationContext = {
    tx,
    organizationId: input.organizationId,
    actorId: input.actorId,
    now,
    dryRun: Boolean(input.dryRun),
    counters,
    activeByKey,
    applicableConfigByEntity: new Map(),
    expectedActiveKeys: new Set(),
    blockedEntities: new Set(),
  };

  const reportSet = new Set<string>();
  for (const [scope, entries] of configsByScope) {
    if (entries.length < 2) continue;
    counters.errors += 1;
    reportSet.add(scope);
    await insertAudit(tx, {
      organizationId: input.organizationId,
      actorId: input.actorId,
      action: "view",
      entity: "sla_config",
      details: {
        operation: "configuration_conflict",
        scope,
        configIds: entries.map((entry) => entry.id),
      },
    });
  }
  const assetsById = new Map<number, AssetSlaLike>();
  for (const asset of assets as AssetSlaLike[]) {
    assetsById.set(asset.id, asset);
    if (asset.status === "desativado") continue;
    const resolution = resolveSlaConfig(activeConfigRows, asset.id, asset.domainId);
    const key = entityKey("asset", asset.id);
    if (resolution.conflict) {
      ctx.blockedEntities.add(key);
      counters.skipped += 1;
      await reportConfigConflict(ctx, resolution, reportSet);
      continue;
    }
    ctx.applicableConfigByEntity.set(key, resolution.config?.id ?? null);
    if (!resolution.config) {
      counters.skipped += 1;
      continue;
    }
    counters.evaluated += 1;
    for (const observation of evaluateAssetSla(asset, resolution.config, now)) {
      await refreshOrOpen(ctx, "asset", asset.id, resolution.config, observation);
    }
  }

  for (const request of requests as AccessRequestSlaLike[]) {
    const asset = assetsById.get(request.assetId);
    const requestKey = entityKey("access_request", request.id);
    // A request and its asset must independently belong to this tenant.
    if (!asset || asset.organizationId !== input.organizationId || request.organizationId !== input.organizationId) {
      ctx.blockedEntities.add(requestKey);
      counters.skipped += 1;
      continue;
    }
    const resolution = resolveSlaConfig(activeConfigRows, asset.id, asset.domainId);
    if (resolution.conflict) {
      ctx.blockedEntities.add(requestKey);
      counters.skipped += 1;
      await reportConfigConflict(ctx, resolution, reportSet);
      continue;
    }
    ctx.applicableConfigByEntity.set(requestKey, resolution.config?.id ?? null);
    if (!resolution.config) {
      counters.skipped += 1;
      continue;
    }
    counters.evaluated += 1;
    for (const observation of evaluateAccessRequestSla(request, resolution.config, now)) {
      await refreshOrOpen(ctx, "access_request", request.id, resolution.config, observation);
    }
  }

  await resolveObsoleteViolations(ctx);
  const runStatus: "completed" | "failed" = counters.errors > 0 ? "failed" : "completed";
  const completed: EvaluateSlaResult = { runId, status: runStatus, counters, notifications: notificationInfo() };
  await tx.update(slaEvaluationRuns).set({ status: runStatus, finishedAt: now, details: {
    ...counters,
    dryRun: Boolean(input.dryRun),
    notifications: "deferred",
  } }).where(eq(slaEvaluationRuns.runId, runId));
  await insertAudit(tx, {
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "update",
    entity: "sla_evaluation_run",
    details: { runId, operation: "finished", status: runStatus, counters, notifications: "deferred" },
  });
  return completed;
}

/** Executa uma avaliação tenant-scoped e mantém toda a mutação dentro de uma transação. */
export async function evaluateSla(input: EvaluateSlaInput): Promise<EvaluateSlaResult> {
  if (!Number.isInteger(input.organizationId) || input.organizationId <= 0) throw new Error("organizationId must be a positive integer");
  if (input.source !== "manual" && input.source !== "scheduler") throw new Error("source must be manual or scheduler");
  const runId = randomUUID();
  const now = validNow(input.now ?? new Date());
  const db = await getDb();
  if (!db) {
    return {
      runId,
      status: "failed",
      counters: { ...emptyCounters(), errors: 1 },
      notifications: notificationInfo(),
    };
  }

  try {
    return await db.transaction((tx: any) => runEvaluationInTransaction(tx, {
      organizationId: input.organizationId,
      source: input.source,
      actorId: input.actorId,
      dryRun: input.dryRun,
      now,
    }, runId));
  } catch (error) {
    // A transaction that aborts cannot update its own run. Re-record a failed
    // run in a fresh transaction so an operational error never looks successful.
    try {
      await db.transaction(async (tx: any) => {
        await tx.insert(slaEvaluationRuns).values({
          organizationId: input.organizationId,
          runId,
          source: input.source,
          status: "failed",
          startedAt: now,
          finishedAt: now,
          actorId: input.actorId ?? null,
          details: { error: "evaluation_failed", notifications: "deferred" },
        }).onConflictDoNothing();
        await insertAudit(tx, {
          organizationId: input.organizationId,
          actorId: input.actorId,
          action: "update",
          entity: "sla_evaluation_run",
          details: { runId, operation: "failed", error: "evaluation_failed" },
        });
      });
    } catch {
      // Do not mask the original evaluation error; the return still says failed.
    }
    return {
      runId,
      status: "failed",
      counters: { ...emptyCounters(), errors: 1 },
      notifications: notificationInfo(),
    };
  }
}
