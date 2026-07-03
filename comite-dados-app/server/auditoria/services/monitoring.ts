import { eq, and, gte, lte, desc } from "drizzle-orm";
import { getDb } from "../../db";
import * as auditoriaSchema from "../../db-auditoria";
import {
  copilotKnowledgeBase,
  aiWeeklyMetrics,
  aiCostSavingsLog,
} from "../../db-auditoria";

/**
 * Agrega as métricas da última semana e salva no banco de dados.
 * Retorna os dados agregados.
 */
export async function generateWeeklyMetrics(tenantCatalog: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date();
  const weekEndDate = new Date(now);
  const weekStartDate = new Date(now);
  weekStartDate.setDate(now.getDate() - 7);

  // 1. Total de perguntas e top perguntas
  const questions = await db
    .select()
    .from(copilotKnowledgeBase)
    .where(
      and(
        eq(copilotKnowledgeBase.tenantCatalog, tenantCatalog),
        gte(copilotKnowledgeBase.createdAt, weekStartDate),
        lte(copilotKnowledgeBase.createdAt, weekEndDate)
      )
    )
    .orderBy(desc(copilotKnowledgeBase.hitCount));

  const totalQuestions = questions.length;
  const topQuestions = questions.slice(0, 5).map((q) => ({
    question: q.question,
    hits: q.hitCount,
    saved: (q.hitCount * (q.costSavedPerHitUSD || 0)).toFixed(4),
  }));

  // 2. Custos e economia (buscando dos logs diários da semana)
  const savingsLogs = await db
    .select()
    .from(aiCostSavingsLog)
    .where(
      and(
        eq(aiCostSavingsLog.tenantCatalog, tenantCatalog),
        gte(aiCostSavingsLog.createdAt, weekStartDate),
        lte(aiCostSavingsLog.createdAt, weekEndDate)
      )
    );

  let totalSavedUSD = 0;
  let totalLLMCallsMade = 0;
  let totalLLMCallsAvoided = 0;

  savingsLogs.forEach((log) => {
    totalSavedUSD += log.totalCostSavedUSD;
    totalLLMCallsMade += log.totalLLMCallsMade;
    totalLLMCallsAvoided += log.totalLLMCallsAvoided;
  });

  // Cálculo de Custo Real (estimativa baseada em chamadas feitas vs evitadas)
  // Custo médio por chamada completa sem cache: ~$0.00015
  const avgCostPerCall = 0.00015;
  const totalCostUSD = totalLLMCallsMade * avgCostPerCall;

  // Taxa de Hit do Cache
  const totalAttempts = totalLLMCallsMade + totalLLMCallsAvoided;
  const cacheHitRate =
    totalAttempts > 0 ? (totalLLMCallsAvoided / totalAttempts) * 100 : 0;

  // 3. Detecção de Anomalias
  const anomalies: Array<{ type: string; message: string; severity: string }> = [];
  if (totalCostUSD > 5.0) {
    anomalies.push({
      type: "high_cost",
      message: `Custo semanal (${totalCostUSD.toFixed(2)} USD) excedeu o limite de alerta de 5.00 USD.`,
      severity: "warning",
    });
  }

  if (cacheHitRate < 20 && totalQuestions > 10) {
    anomalies.push({
      type: "low_cache_hit",
      message: `Taxa de reutilização muito baixa (${cacheHitRate.toFixed(1)}%). O Knowledge Base não está sendo aproveitado.`,
      severity: "info",
    });
  }

  // 4. Salvar métricas consolidadas
  const [metric] = await db
    .insert(aiWeeklyMetrics)
    .values({
      tenantCatalog,
      weekStartDate,
      weekEndDate,
      totalQuestions,
      totalCostUSD,
      cacheHitRate,
      totalSavedUSD,
      rateLimitBlocks: 0,
      topQuestionsJson: topQuestions,
      anomaliesJson: anomalies,
    })
    .returning();

  return metric;
}

/**
 * Busca a métrica semanal mais recente para exibir no painel.
 */
export async function getLatestWeeklyMetrics(tenantCatalog: string) {
  const db = await getDb();
  if (!db) return null;

  const [latest] = await db
    .select()
    .from(aiWeeklyMetrics)
    .where(eq(aiWeeklyMetrics.tenantCatalog, tenantCatalog))
    .orderBy(desc(aiWeeklyMetrics.createdAt))
    .limit(1);

  return latest || null;
}
