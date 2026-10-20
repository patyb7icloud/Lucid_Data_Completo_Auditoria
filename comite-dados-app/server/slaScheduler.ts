import { organizations } from "../drizzle/schema";
import { evaluateSla } from "./slaEvaluator";
import { getDb } from "./db";
import { logger } from "./_core/logger";

const DAY_MS = 24 * 60 * 60 * 1000;
let initialTimer: NodeJS.Timeout | undefined;
let dailyTimer: NodeJS.Timeout | undefined;
let running = false;

export async function runScheduledSlaEvaluation(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const db = await getDb();
    if (!db) {
      logger.warn("sla.scheduler_skipped", { reason: "database_unavailable" });
      return;
    }
    const tenants = await db.select({ id: organizations.id }).from(organizations);
    for (const tenant of tenants) {
      try {
        const result = await evaluateSla({ organizationId: tenant.id, source: "scheduler" });
        logger.info("sla.evaluation_finished", {
          organizationId: tenant.id,
          runId: result.runId,
          status: result.status,
          counters: result.counters,
          notifications: "deferred",
        });
      } catch (error) {
        logger.error("sla.evaluation_failed", {
          organizationId: tenant.id,
          errorClass: error instanceof Error ? error.name : "UnknownError",
        });
      }
    }
  } catch (error) {
    logger.error("sla.scheduler_failed", {
      errorClass: error instanceof Error ? error.name : "UnknownError",
    });
  } finally {
    running = false;
  }
}

export function startSlaScheduler(): void {
  if (initialTimer || dailyTimer) return;
  // Delay initial run so web startup is not blocked by evaluation or provider latency.
  initialTimer = setTimeout(() => {
    initialTimer = undefined;
    void runScheduledSlaEvaluation();
    dailyTimer = setInterval(() => void runScheduledSlaEvaluation(), DAY_MS);
  }, 30_000);
  initialTimer.unref?.();
}

export function stopSlaScheduler(): void {
  if (initialTimer) clearTimeout(initialTimer);
  if (dailyTimer) clearInterval(dailyTimer);
  initialTimer = undefined;
  dailyTimer = undefined;
}
