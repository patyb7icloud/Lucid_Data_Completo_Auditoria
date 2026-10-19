import { pgTable, serial, integer, varchar, doublePrecision, text, timestamp, json } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export const auditSessions = pgTable("audit_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  databricksHost: varchar("databricksHost", { length: 512 }).notNull(),
  targetCatalog: varchar("targetCatalog", { length: 256 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  governanceScore: doublePrecision("governanceScore"),
  totalCatalogs: integer("totalCatalogs"),
  totalSchemas: integer("totalSchemas"),
  totalTables: integer("totalTables"),
  docCoverage: doublePrecision("docCoverage"),
  tagCoverage: doublePrecision("tagCoverage"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const analysisResults = pgTable("analysis_results", {
  id: serial("id").primaryKey(),
  sessionId: integer("sessionId").notNull(),
  analysisType: varchar("analysisType", { length: 32 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  resultData: json("resultData"),
  recommendations: json("recommendations"),
  gaps: json("gaps"),
  score: doublePrecision("score"),
  executionMs: integer("executionMs"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const copilotKnowledgeBase = pgTable("copilot_knowledge_base", {
  id: serial("id").primaryKey(),
  tenantCatalog: varchar("tenantCatalog", { length: 256 }).notNull(),
  question: text("question").notNull(),
  questionNormalized: text("questionNormalized").notNull(),
  sqlExecuted: text("sqlExecuted"),
  answer: text("answer").notNull(),
  resultData: json("resultData"),
  intent: varchar("intent", { length: 16 }).default("read"),
  questionType: varchar("questionType", { length: 16 }).notNull().default("operational"),
  answerPromptTemplate: text("answerPromptTemplate"),
  askedByUserId: integer("askedByUserId"),
  askedByEmail: varchar("askedByEmail", { length: 320 }),
  hitCount: integer("hitCount").notNull().default(0),
  costSavedPerHitUSD: doublePrecision("costSavedPerHitUSD").default(0.0097),
  expiresAt: timestamp("expiresAt"),
  feedback: varchar("feedback", { length: 16 }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const selfHealingKnowledgeBase = pgTable("self_healing_knowledge_base", {
  id: serial("id").primaryKey(),
  tenantCatalog: varchar("tenantCatalog", { length: 256 }).notNull(),
  schemaName: varchar("schemaName", { length: 256 }).notNull(),
  tableName: varchar("tableName", { length: 256 }).notNull(),
  suggestions: json("suggestions").notNull(),
  applicationStatus: varchar("applicationStatus", { length: 32 }).notNull().default("pending_review"),
  appliedByUserId: integer("appliedByUserId"),
  appliedAt: timestamp("appliedAt"),
  costSavedPerHitUSD: doublePrecision("costSavedPerHitUSD").default(0.01425),
  hitCount: integer("hitCount").notNull().default(0),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const aiCostSavingsLog = pgTable("ai_cost_savings_log", {
  id: serial("id").primaryKey(),
  tenantCatalog: varchar("tenantCatalog", { length: 256 }).notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  copilotHits: integer("copilotHits").notNull().default(0),
  selfHealingHits: integer("selfHealingHits").notNull().default(0),
  totalCostSavedUSD: doublePrecision("totalCostSavedUSD").notNull().default(0),
  totalLLMCallsMade: integer("totalLLMCallsMade").notNull().default(0),
  totalLLMCallsAvoided: integer("totalLLMCallsAvoided").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const aiWeeklyMetrics = pgTable("ai_weekly_metrics", {
  id: serial("id").primaryKey(),
  tenantCatalog: varchar("tenantCatalog", { length: 256 }).notNull(),
  weekStartDate: timestamp("weekStartDate").notNull(),
  weekEndDate: timestamp("weekEndDate").notNull(),
  totalQuestions: integer("totalQuestions").notNull().default(0),
  totalCostUSD: doublePrecision("totalCostUSD").notNull().default(0),
  cacheHitRate: doublePrecision("cacheHitRate").notNull().default(0),
  totalSavedUSD: doublePrecision("totalSavedUSD").notNull().default(0),
  rateLimitBlocks: integer("rateLimitBlocks").notNull().default(0),
  topQuestionsJson: json("topQuestionsJson"),
  anomaliesJson: json("anomaliesJson"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

// ─── Instância de DB compartilhada (usa a mesma conexão do db.ts principal) ──
let _dbAuditoria: ReturnType<typeof drizzle> | null = null;

export function getAuditoriaDb() {
  if (!_dbAuditoria && process.env.DATABASE_URL) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    _dbAuditoria = drizzle(pool);
  }
  return _dbAuditoria;
}

// Encaminhamento tipado para compatibilidade com imports existentes.
type AuditoriaDb = ReturnType<typeof drizzle>;
type InsertTable = Parameters<AuditoriaDb["insert"]>[0];
type UpdateTable = Parameters<AuditoriaDb["update"]>[0];
type DeleteTable = Parameters<AuditoriaDb["delete"]>[0];

function requireAuditoriaDb(): AuditoriaDb {
  const database = getAuditoriaDb();
  if (!database) throw new Error("Database not available");
  return database;
}

export const db = {
  select: () => requireAuditoriaDb().select(),
  insert: (table: InsertTable) => requireAuditoriaDb().insert(table),
  update: (table: UpdateTable) => requireAuditoriaDb().update(table),
  delete: (table: DeleteTable) => requireAuditoriaDb().delete(table),
};
