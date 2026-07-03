import { getDb } from "../../db";
import * as auditoriaSchema from "../../db-auditoria";
import { copilotKnowledgeBase, selfHealingKnowledgeBase, aiCostSavingsLog } from "../../db-auditoria";
import { eq, and, gt, desc, or, isNull } from "drizzle-orm";
import { sql } from "drizzle-orm";

/**
 * Normaliza uma pergunta para busca (lowercase, remove acentos e pontuação extra)
 */
function normalizeQuestion(q: string): string {
  return q.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/gi, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Busca uma resposta no Knowledge Base persistente
 */
export async function findInCopilotKnowledgeBase(tenantCatalog: string, question: string) {
  const db = await getDb();
  if (!db) return null;
  
  const normalized = normalizeQuestion(question);
  
  // Busca exata pela string normalizada (em produção, usar pgvector para busca semântica)
  const results = await db.select()
    .from(copilotKnowledgeBase)
    .where(
      and(
        eq(copilotKnowledgeBase.tenantCatalog, tenantCatalog),
        eq(copilotKnowledgeBase.questionNormalized, normalized),
        // Permitir: expiresAt NULL (nunca expira) OU expiresAt > agora
        or(
          isNull(copilotKnowledgeBase.expiresAt),
          gt(copilotKnowledgeBase.expiresAt, new Date())
        )
      )
    )
    .limit(1);
    
  if (results.length > 0) {
    const entry = results[0];
    
    // Atualiza as métricas de economia (Hit Count)
    await db.update(copilotKnowledgeBase)
      .set({ hitCount: entry.hitCount + 1 })
      .where(eq(copilotKnowledgeBase.id, entry.id));
      
    await logCostSavings(tenantCatalog, "copilot", entry.costSavedPerHitUSD || 0.0097);
    
    return entry;
  }
  
  return null;
}

/**
 * Salva uma nova resposta no Knowledge Base
 */
export async function saveToCopilotKnowledgeBase(data: {
  tenantCatalog: string;
  question: string;
  sqlExecuted?: string;
  answer: string;
  resultData?: any;
  intent?: string;
  questionType: "structural" | "operational";
  answerPromptTemplate?: string;
}) {
  const db = await getDb();
  if (!db) return;
  
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // TTL de 24h por padrão para dados dinâmicos
  
  await db.insert(copilotKnowledgeBase).values({
    tenantCatalog: data.tenantCatalog,
    question: data.question,
    questionNormalized: normalizeQuestion(data.question),
    sqlExecuted: data.sqlExecuted,
    answer: data.answer,
    resultData: data.resultData,
    intent: data.intent || "read",
    questionType: data.questionType,
    answerPromptTemplate: data.answerPromptTemplate,
    expiresAt,
  });
}

/**
 * Busca sugestões do Self-Healing no Knowledge Base
 */
export async function findInSelfHealingKnowledgeBase(tenantCatalog: string, schemaName: string, tableName: string) {
  const db = await getDb();
  if (!db) return null;
  
  const results = await db.select()
    .from(selfHealingKnowledgeBase)
    .where(
      and(
        eq(selfHealingKnowledgeBase.tenantCatalog, tenantCatalog),
        eq(selfHealingKnowledgeBase.schemaName, schemaName),
        eq(selfHealingKnowledgeBase.tableName, tableName),
        // Permitir: expiresAt NULL (nunca expira) OU expiresAt > agora
        or(
          isNull(selfHealingKnowledgeBase.expiresAt),
          gt(selfHealingKnowledgeBase.expiresAt, new Date())
        )
      )
    )
    .limit(1);
    
  if (results.length > 0) {
    const entry = results[0];
    
    await db.update(selfHealingKnowledgeBase)
      .set({ hitCount: entry.hitCount + 1 })
      .where(eq(selfHealingKnowledgeBase.id, entry.id));
      
    await logCostSavings(tenantCatalog, "self_healing", entry.costSavedPerHitUSD || 0.01425);
    
    return entry.suggestions;
  }
  
  return null;
}

/**
 * Salva sugestões do Self-Healing no Knowledge Base
 */
export async function saveToSelfHealingKnowledgeBase(data: {
  tenantCatalog: string;
  schemaName: string;
  tableName: string;
  suggestions: any;
}) {
  const db = await getDb();
  if (!db) return;
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // Sugestões estruturais duram mais (7 dias)
  
  await db.insert(selfHealingKnowledgeBase).values({
    tenantCatalog: data.tenantCatalog,
    schemaName: data.schemaName,
    tableName: data.tableName,
    suggestions: data.suggestions,
    expiresAt,
  });
}

/**
 * Registra a economia gerada para o painel de FinOps
 */
async function logCostSavings(tenantCatalog: string, type: "copilot" | "self_healing", amountSaved: number) {
  const db = await getDb();
  if (!db) return;
  
  const today = new Date().toISOString().split('T')[0];
  
  const existingLog = await db.select()
    .from(aiCostSavingsLog)
    .where(
      and(
        eq(aiCostSavingsLog.tenantCatalog, tenantCatalog),
        eq(aiCostSavingsLog.date, today)
      )
    )
    .limit(1);
    
  if (existingLog.length > 0) {
    const log = existingLog[0];
    await db.update(aiCostSavingsLog)
      .set({
        copilotHits: type === "copilot" ? log.copilotHits + 1 : log.copilotHits,
        selfHealingHits: type === "self_healing" ? log.selfHealingHits + 1 : log.selfHealingHits,
        totalCostSavedUSD: log.totalCostSavedUSD + amountSaved,
        totalLLMCallsAvoided: log.totalLLMCallsAvoided + 1
      })
      .where(eq(aiCostSavingsLog.id, log.id));
  } else {
    await db.insert(aiCostSavingsLog).values({
      tenantCatalog,
      date: today,
      copilotHits: type === "copilot" ? 1 : 0,
      selfHealingHits: type === "self_healing" ? 1 : 0,
      totalCostSavedUSD: amountSaved,
      totalLLMCallsAvoided: 1,
      totalLLMCallsMade: 0
    });
  }
}
