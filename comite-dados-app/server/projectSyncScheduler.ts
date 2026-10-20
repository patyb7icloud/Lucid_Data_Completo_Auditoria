import { and, eq, sql } from "drizzle-orm";
import { aiProjects, externalProjectSyncs } from "../drizzle/schema";
import { getDb } from "./db";
import { upsertServiceNowProject } from "./integrations/serviceNow";
import { upsertAzureDevOpsProject } from "./integrations/azureDevOps";
import { logger } from "./_core/logger";

export type ProjectSyncProvider = "servicenow" | "azure_devops";
const CHECK_INTERVAL_MS = 60_000;
let timer: NodeJS.Timeout | undefined;
let running = false;

function providerConfigured(provider: ProjectSyncProvider): boolean {
  if (provider === "servicenow") {
    return Boolean(
      process.env.SERVICENOW_INSTANCE_URL &&
      (process.env.SERVICENOW_ACCESS_TOKEN || (process.env.SERVICENOW_USERNAME && process.env.SERVICENOW_PASSWORD)),
    );
  }
  return Boolean(
    process.env.AZURE_DEVOPS_ORGANIZATION &&
    process.env.AZURE_DEVOPS_PROJECT &&
    (process.env.AZURE_DEVOPS_ACCESS_TOKEN || process.env.AZURE_DEVOPS_PAT),
  );
}

export function configuredProjectSyncProviders(): ProjectSyncProvider[] {
  return (["servicenow", "azure_devops"] as const).filter(providerConfigured);
}

export async function enqueueProjectSyncs(
  organizationId: number,
  projectId: number,
  providers: ProjectSyncProvider[] = configuredProjectSyncProviders(),
): Promise<{ queued: ProjectSyncProvider[]; skipped: ProjectSyncProvider[] }> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  if (!Number.isInteger(organizationId) || organizationId <= 0 || !Number.isInteger(projectId) || projectId <= 0) {
    throw new Error("Invalid tenant/project identifier");
  }
  const uniqueProviders = [...new Set(providers)];
  const queued: ProjectSyncProvider[] = [];
  const skipped: ProjectSyncProvider[] = [];
  for (const provider of uniqueProviders) {
    if (!providerConfigured(provider)) {
      skipped.push(provider);
      continue;
    }
    const now = new Date();
    await db.insert(externalProjectSyncs).values({
      organizationId,
      projectId,
      provider,
      status: "pending",
      idempotencyKey: `${organizationId}:${projectId}:${provider}`,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [externalProjectSyncs.organizationId, externalProjectSyncs.projectId, externalProjectSyncs.provider],
      set: { status: "pending", errorMessage: null, updatedAt: now },
    });
    queued.push(provider);
  }
  return { queued, skipped };
}

function getProjectInput(project: typeof aiProjects.$inferSelect) {
  return {
    projectId: String(project.id),
    name: project.name,
    description: project.description ?? undefined,
    riskLevel: project.riskLevel,
    projectType: project.projectType,
    servicenowTicket: project.servicenowTicket ?? undefined,
    azureDevopsUrl: project.azureDevopsUrl ?? undefined,
  };
}

async function processOne(sync: typeof externalProjectSyncs.$inferSelect): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const [claimed] = await db.update(externalProjectSyncs).set({
    status: "processing",
    attempts: sql`${externalProjectSyncs.attempts} + 1`,
    lastAttemptAt: new Date(),
    updatedAt: new Date(),
  }).where(and(
    eq(externalProjectSyncs.id, sync.id),
    eq(externalProjectSyncs.status, "pending"),
  )).returning();
  if (!claimed) return;

  try {
    const [project] = await db.select().from(aiProjects).where(and(
      eq(aiProjects.id, claimed.projectId),
      eq(aiProjects.organizationId, claimed.organizationId),
    )).limit(1);
    if (!project) throw new Error("ProjectNotFound");
    const input = getProjectInput(project);
    const result = claimed.provider === "servicenow"
      ? await upsertServiceNowProject(input)
      : claimed.provider === "azure_devops"
        ? await upsertAzureDevOpsProject(input)
        : (() => { throw new Error("UnsupportedProvider"); })();

    await db.transaction(async tx => {
      await tx.update(externalProjectSyncs).set({
        status: "succeeded",
        remoteId: result.remoteId,
        remoteNumber: result.remoteNumber ?? null,
        remoteUrl: result.remoteUrl,
        lastSuccessAt: new Date(),
        errorMessage: null,
        updatedAt: new Date(),
      }).where(and(
        eq(externalProjectSyncs.id, claimed.id),
        eq(externalProjectSyncs.organizationId, claimed.organizationId),
      ));
      if (claimed.provider === "servicenow") {
        await tx.update(aiProjects).set({
          servicenowTicket: result.remoteNumber ?? result.remoteId,
          updatedAt: new Date(),
        }).where(and(eq(aiProjects.id, claimed.projectId), eq(aiProjects.organizationId, claimed.organizationId)));
      } else {
        await tx.update(aiProjects).set({
          azureDevopsUrl: result.remoteUrl,
          updatedAt: new Date(),
        }).where(and(eq(aiProjects.id, claimed.projectId), eq(aiProjects.organizationId, claimed.organizationId)));
      }
    });
    logger.info("integration.project_sync_succeeded", {
      organizationId: claimed.organizationId,
      projectId: claimed.projectId,
      provider: claimed.provider,
      remoteNumber: result.remoteNumber ?? null,
    });
  } catch (error) {
    await db.update(externalProjectSyncs).set({
      status: "failed",
      errorMessage: `${claimed.provider} sync failed (${error instanceof Error ? error.name : "UnknownError"})`,
      updatedAt: new Date(),
    }).where(and(
      eq(externalProjectSyncs.id, claimed.id),
      eq(externalProjectSyncs.organizationId, claimed.organizationId),
    )).catch(() => undefined);
    logger.warn("integration.project_sync_failed", {
      organizationId: claimed.organizationId,
      projectId: claimed.projectId,
      provider: claimed.provider,
      errorClass: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

export async function runPendingProjectSyncs(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const db = await getDb();
    if (!db) return;
    const pending = await db.select().from(externalProjectSyncs)
      .where(eq(externalProjectSyncs.status, "pending"))
      .orderBy(externalProjectSyncs.createdAt)
      .limit(20);
    for (const sync of pending) await processOne(sync);
  } catch (error) {
    logger.error("integration.project_sync_worker_failed", {
      errorClass: error instanceof Error ? error.name : "UnknownError",
    });
  } finally {
    running = false;
  }
}

export function startProjectSyncScheduler(): void {
  if (timer) return;
  timer = setInterval(() => void runPendingProjectSyncs(), CHECK_INTERVAL_MS);
  timer.unref?.();
}

export function stopProjectSyncScheduler(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}
