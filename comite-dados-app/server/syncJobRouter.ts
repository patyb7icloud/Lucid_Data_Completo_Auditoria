import { protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { systemSettings } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { scheduleSyncJob, runDatabricksSync } from "./services/syncScheduler";

export const syncJobRouter = router({
  getConfig: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    const settings = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, "databricks_sync_cron"));

    const lastSync = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, "databricks_last_sync"));

    const cronExpression = settings.length > 0 && settings[0].value 
      ? settings[0].value 
      : "0 2 * * *";

    const lastSyncTime = lastSync.length > 0 && lastSync[0].value 
      ? lastSync[0].value 
      : null;

    return { cronExpression, lastSyncTime };
  }),

  updateConfig: protectedProcedure
    .input(z.object({ cronExpression: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      await db
        .insert(systemSettings)
        .values({
          key: "databricks_sync_cron",
          value: input.cronExpression,
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: { value: input.cronExpression },
        });

      // Restart the cron job with new schedule
      await scheduleSyncJob();
      
      return { success: true };
    }),

  triggerNow: protectedProcedure.mutation(async () => {
    // Run the sync process immediately
    await runDatabricksSync();
    return { success: true };
  }),
});
