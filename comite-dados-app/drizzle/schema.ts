import { relations, sql } from "drizzle-orm";
import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
  boolean,
  real,
  jsonb,
  smallint,
  serial,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────
export const userRoleEnum        = pgEnum("user_role",         ["user", "admin", "data_steward", "data_owner", "data_analyst"]);
export const domainStatusEnum    = pgEnum("domain_status",     ["planejado", "em_andamento", "concluido", "pausado"]);
export const tierStatusEnum      = pgEnum("tier_status",       ["pendente_revisao", "aprovado", "sincronizado", "revogado"]);
export const participantRoleEnum = pgEnum("participant_role",  ["data_owner","data_steward","product_owner","project_manager","ai_owner","ai_steward","ai_ethics_officer","ml_engineer","model_manager","data_engineer","data_architect","facilitador","representante_negocio","outro"]);
export const participantStatusEnum = pgEnum("participant_status", ["ativo", "inativo", "a_designar"]);
export const meetingStatusEnum   = pgEnum("meeting_status",    ["agendada", "realizada", "cancelada", "adiada"]);
export const meetingTypeEnum     = pgEnum("meeting_type",      ["ordinaria", "extraordinaria", "piloto", "workshop"]);
export const agendaStatusEnum    = pgEnum("agenda_status",     ["pendente", "em_andamento", "concluido"]);
export const inviteStatusEnum    = pgEnum("invite_status",     ["pendente", "confirmado", "recusado", "talvez"]);
export const raciValueEnum       = pgEnum("raci_value",        ["R", "A", "C", "I", "-"]);
export const aiChatRoleEnum      = pgEnum("ai_chat_role",      ["user", "assistant"]);
export const emailTypeEnum       = pgEnum("email_type",        ["meeting_invite","meeting_reminder","meeting_cancelled","decision_registered","meeting_summary","invite_confirmed","invite_declined","domain_update","custom"]);
export const emailStatusEnum     = pgEnum("email_status",      ["pendente", "enviado", "falhou", "cancelado"]);
export const exportDocTypeEnum   = pgEnum("export_doc_type",   ["meeting_minutes_pdf","meeting_minutes_docx","organogram_pdf","metrics_report_pdf"]);
export const exportFileFormatEnum= pgEnum("export_file_format",["pdf", "docx"]);
export const attendanceSourceEnum= pgEnum("attendance_source", ["teams", "manual"]);
export const feedbackTypeEnum    = pgEnum("feedback_type",     ["sugestao", "bug", "elogio", "outro"]);
export const feedbackStatusEnum  = pgEnum("feedback_status",   ["novo", "em_analise", "concluido"]);
export const assetTypeEnum       = pgEnum("asset_type",        ["tabela", "api", "arquivo", "dashboard", "outro"]);
export const sensitivityEnum     = pgEnum("sensitivity",       ["publico", "interno", "confidencial", "restrito"]);
export const assetStatusEnum     = pgEnum("asset_status",      ["ativo", "em_construcao", "desativado"]);
export const criticalityEnum     = pgEnum("criticality",       ["baixa", "media", "alta", "critica"]);
export const piiPolicyStatusEnum = pgEnum("pii_policy_status", ["pendente_revisao", "aprovado", "rejeitado", "sincronizado"]);
export const lineageTypeEnum     = pgEnum("lineage_type",      ["direto", "transformado", "agregado"]);
export const qualityStatusEnum   = pgEnum("quality_status",    ["sucesso", "alerta", "falha"]);
export const qualityRuleTypeEnum = pgEnum("quality_rule_type", ["completude", "unicidade", "validade", "consistencia", "regex"]);
export const accessNivelEnum     = pgEnum("access_nivel",      ["leitura", "leitura_escrita"]);
export const accessBaseLegalEnum = pgEnum("access_base_legal", ["legitimo_interesse", "execucao_contrato"]);
export const accessStatusOwnerEnum   = pgEnum("access_status_owner",   ["pendente", "aprovado", "rejeitado"]);
export const accessStatusStewardEnum = pgEnum("access_status_steward", ["pendente", "aguardando", "aprovado", "rejeitado"]);
export const accessStatusEnum    = pgEnum("access_status",     ["pendente_owner","pendente_steward","aprovado","rejeitado_owner","rejeitado_steward"]);
export const accessFlowTypeEnum  = pgEnum("access_flow_type",  ["acesso_dados", "dados_restritos", "terceiros", "projeto_ia"]);
export const priorityEnum        = pgEnum("priority",          ["baixa", "media", "alta", "critica"]);
export const orgPlanEnum         = pgEnum("org_plan",          ["starter", "professional", "enterprise"]);
export const slaEntityTypeEnum   = pgEnum("sla_entity_type",   ["asset", "domain", "global"]);
export const slaViolEntityEnum   = pgEnum("sla_viol_entity",   ["asset", "access_request"]);
export const slaViolTypeEnum     = pgEnum("sla_viol_type",     ["stale_data", "low_quality", "slow_access_response"]);
export const ssoProviderEnum     = pgEnum("sso_provider",      ["saml", "oidc"]);
export const auditActionEnum     = pgEnum("audit_action",      ["create","update","delete","view","export","approve","reject","login","logout","access_request","role_change"]);
export const glossaryStatusEnum  = pgEnum("glossary_status",   ["rascunho", "em_revisao", "aprovado", "obsoleto"]);
export const contractStatusEnum  = pgEnum("contract_status",   ["rascunho", "em_revisao", "ativo", "expirado", "cancelado"]);
export const piaStatusEnum       = pgEnum("pia_status",        ["rascunho", "em_revisao", "aprovado", "rejeitado"]);
export const piaRiskEnum         = pgEnum("pia_risk",          ["baixo", "medio", "alto", "critico"]);
export const dsarTypeEnum        = pgEnum("dsar_type",         ["acesso","retificacao","exclusao","portabilidade","oposicao","revogacao_consentimento"]);
export const dsarStatusEnum      = pgEnum("dsar_status",       ["aberto", "em_andamento", "concluido", "rejeitado"]);
export const workflowStatusEnum  = pgEnum("workflow_status",   ["pending", "approved", "rejected", "cancelled"]);
export const workflowDecisionEnum= pgEnum("workflow_decision", ["approved", "rejected", "delegated", "commented"]);
export const intakeTypeEnum      = pgEnum("intake_type",       ["dado","projeto_ia","compliance","qualidade","acesso","outro"]);
export const intakePriorityEnum  = pgEnum("intake_priority",   ["baixa", "media", "alta", "critica"]);
export const containsPiiEnum     = pgEnum("contains_pii",      ["sim", "nao", "nao_sei"]);
export const dataSensitivityEnum = pgEnum("data_sensitivity",  ["publico", "interno", "confidencial", "restrito"]);
export const intakeStatusEnum    = pgEnum("intake_status",     ["rascunho","submetido","em_triagem","aprovado_estrategico","aprovado_operacional","retornado","rejeitado","em_execucao","em_validacao","concluido"]);
export const priorityTierEnum    = pgEnum("priority_tier",     ["P1", "P2", "P3", "P4"]);
export const tagAppliesToEnum    = pgEnum("tag_applies_to",    ["table", "column", "both"]);

// ─── Users (Auth) ────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 256 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  mustChangePassword: boolean("mustChangePassword").default(false).notNull(),
  organizationId: integer("organizationId").default(1),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Domains ─────────────────────────────────────────────────────────────────
export const domains = pgTable("domains", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  responsible: varchar("responsible", { length: 256 }),
  color: varchar("color", { length: 16 }).default("#1B3A8C"),
  icon: varchar("icon", { length: 64 }).default("Building2"),
  implementationProgress: real("implementationProgress").default(0),
  status: domainStatusEnum("status").default("planejado"),
  // ─── Tier de Autonomia Databricks ────────────────────────────────────────────
  tierLevel: integer("tierLevel"),
  tierStatus: tierStatusEnum("tierStatus"),
  tierApprovedBy: varchar("tierApprovedBy", { length: 320 }),
  tierApprovedAt: timestamp("tierApprovedAt"),
  tierSyncedAt: timestamp("tierSyncedAt"),
  tierNotes: text("tierNotes"),
  tierDatabricksCatalog: varchar("tierDatabricksCatalog", { length: 256 }),
  tierDatabricksSchema: varchar("tierDatabricksSchema", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Domain = typeof domains.$inferSelect;
export type InsertDomain = typeof domains.$inferInsert;

// ─── Participants ─────────────────────────────────────────────────────────────
export const participants = pgTable("participants", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  jobTitle: varchar("jobTitle", { length: 256 }),
  department: varchar("department", { length: 128 }),
  phone: varchar("phone", { length: 32 }),
  domainId: integer("domainId"),
  role: participantRoleEnum("role").notNull(),
  status: participantStatusEnum("status").default("ativo"),
  avatarUrl: text("avatarUrl"),
  notes: text("notes"),
  userId: integer("userId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Participant = typeof participants.$inferSelect;
export type InsertParticipant = typeof participants.$inferInsert;

// ─── Meetings ─────────────────────────────────────────────────────────────────
export const meetings = pgTable("meetings", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),
  scheduledAt: timestamp("scheduledAt").notNull(),
  endAt: timestamp("endAt"),
  location: varchar("location", { length: 512 }),
  meetingLink: text("meetingLink"),
  status: meetingStatusEnum("status").default("agendada"),
  type: meetingTypeEnum("type").default("ordinaria"),
  domainId: integer("domainId"),
  minutesContent: text("minutesContent"),
  decisionsContent: text("decisionsContent"),
  actionsContent: text("actionsContent"),
  invitesSentAt: timestamp("invitesSentAt"),
  teamsMeetingId: varchar("teamsMeetingId", { length: 512 }),
  teamsJoinUrl: text("teamsJoinUrl"),
  teamsAttendanceSyncedAt: timestamp("teamsAttendanceSyncedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Meeting = typeof meetings.$inferSelect;
export type InsertMeeting = typeof meetings.$inferInsert;

// ─── Meeting Agenda Items ─────────────────────────────────────────────────────
export const agendaItems = pgTable("agenda_items", {
  id: serial("id").primaryKey(),
  meetingId: integer("meetingId").notNull(),
  order: integer("order").default(1),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),
  duration: integer("duration"),
  responsibleId: integer("responsibleId"),
  status: agendaStatusEnum("status").default("pendente"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AgendaItem = typeof agendaItems.$inferSelect;
export type InsertAgendaItem = typeof agendaItems.$inferInsert;

// ─── Invites ──────────────────────────────────────────────────────────────────
export const invites = pgTable("invites", {
  id: serial("id").primaryKey(),
  meetingId: integer("meetingId").notNull(),
  participantId: integer("participantId").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  status: inviteStatusEnum("status").default("pendente"),
  sentAt: timestamp("sentAt").default(sql`null`),
  respondedAt: timestamp("respondedAt").default(sql`null`),
  responseNote: text("responseNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Invite = typeof invites.$inferSelect;
export type InsertInvite = typeof invites.$inferInsert;

// ─── RACI Matrix ──────────────────────────────────────────────────────────────
export const raciMatrix = pgTable("raci_matrix", {
  id: serial("id").primaryKey(),
  activity: varchar("activity", { length: 512 }).notNull(),
  category: varchar("category", { length: 128 }),
  domainId: integer("domainId"),
  dataOwner:       raciValueEnum("dataOwner").default("-"),
  dataSteward:     raciValueEnum("dataSteward").default("-"),
  productOwner:    raciValueEnum("productOwner").default("-"),
  projectManager:  raciValueEnum("projectManager").default("-"),
  aiOwner:         raciValueEnum("aiOwner").default("-"),
  aiSteward:       raciValueEnum("aiSteward").default("-"),
  aiEthicsOfficer: raciValueEnum("aiEthicsOfficer").default("-"),
  mlEngineer:      raciValueEnum("mlEngineer").default("-"),
  modelManager:    raciValueEnum("modelManager").default("-"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type RaciMatrix = typeof raciMatrix.$inferSelect;
export type InsertRaciMatrix = typeof raciMatrix.$inferInsert;

// ─── Implementation Checklist ─────────────────────────────────────────────────
export const implementationChecklist = pgTable("implementation_checklist", {
  id: serial("id").primaryKey(),
  domainId: integer("domainId").notNull(),
  phase: varchar("phase", { length: 128 }).notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),
  completed: boolean("completed").default(false),
  completedAt: timestamp("completedAt"),
  completedBy: varchar("completedBy", { length: 256 }),
  order: integer("order").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type ImplementationChecklist = typeof implementationChecklist.$inferSelect;
export type InsertImplementationChecklist = typeof implementationChecklist.$inferInsert;

// ─── AI Chat History ──────────────────────────────────────────────────────────
export const aiChatHistory = pgTable("ai_chat_history", {
  id: serial("id").primaryKey(),
  sessionId: varchar("sessionId", { length: 128 }).notNull(),
  userId: integer("userId"),
  role: aiChatRoleEnum("role").notNull(),
  content: text("content").notNull(),
  context: jsonb("context"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiChatHistory = typeof aiChatHistory.$inferSelect;
export type InsertAiChatHistory = typeof aiChatHistory.$inferInsert;

// ─── ServiceNow Tickets ───────────────────────────────────────────────────────
export const servicenowTickets = pgTable("servicenow_tickets", {
  id: serial("id").primaryKey(),
  ticketNumber: varchar("ticketNumber", { length: 64 }).notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 64 }),
  priority: varchar("priority", { length: 32 }),
  assignedTo: varchar("assignedTo", { length: 256 }),
  domainId: integer("domainId"),
  participantId: integer("participantId"),
  meetingId: integer("meetingId"),
  externalUrl: text("externalUrl"),
  syncedAt: timestamp("syncedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type ServicenowTicket = typeof servicenowTickets.$inferSelect;
export type InsertServicenowTicket = typeof servicenowTickets.$inferInsert;

// ─── Email Notifications ──────────────────────────────────────────────────────
export const emailNotifications = pgTable("email_notifications", {
  id: serial("id").primaryKey(),
  type: emailTypeEnum("type").notNull(),
  recipientId: integer("recipientId"),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  recipientName: varchar("recipientName", { length: 256 }),
  subject: varchar("subject", { length: 512 }).notNull(),
  htmlBody: text("htmlBody").notNull(),
  status: emailStatusEnum("status").default("pendente"),
  sentAt: timestamp("sentAt"),
  errorMessage: text("errorMessage"),
  retryCount: integer("retryCount").default(0),
  meetingId: integer("meetingId"),
  inviteId: integer("inviteId"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type EmailNotification = typeof emailNotifications.$inferSelect;
export type InsertEmailNotification = typeof emailNotifications.$inferInsert;

// ─── Notification Preferences ─────────────────────────────────────────────────
export const notificationPreferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  participantId: integer("participantId").notNull().unique(),
  meetingInvite: boolean("meetingInvite").default(true),
  meetingReminder: boolean("meetingReminder").default(true),
  meetingCancelled: boolean("meetingCancelled").default(true),
  decisionRegistered: boolean("decisionRegistered").default(true),
  meetingSummary: boolean("meetingSummary").default(true),
  domainUpdate: boolean("domainUpdate").default(false),
  reminderHoursBefore: integer("reminderHoursBefore").default(24),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreference = typeof notificationPreferences.$inferInsert;

// ─── Export History ────────────────────────────────────────────────────────────
export const exportHistory = pgTable("export_history", {
  id: serial("id").primaryKey(),
  documentType: exportDocTypeEnum("documentType").notNull(),
  documentTitle: varchar("documentTitle", { length: 512 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  filename: varchar("filename", { length: 256 }).notNull(),
  fileFormat: exportFileFormatEnum("fileFormat").notNull(),
  generatedBy: varchar("generatedBy", { length: 256 }),
  generatedById: integer("generatedById"),
  referenceId: integer("referenceId"),
  referenceName: varchar("referenceName", { length: 256 }),
  fileSizeBytes: integer("fileSizeBytes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ExportHistory = typeof exportHistory.$inferSelect;
export type InsertExportHistory = typeof exportHistory.$inferInsert;

// ─── Meeting Attendance (Teams) ──────────────────────────────────────────────
export const meetingAttendance = pgTable("meeting_attendance", {
  id: serial("id").primaryKey(),
  meetingId: integer("meetingId").notNull(),
  participantId: integer("participantId"),
  participantName: varchar("participantName", { length: 256 }),
  participantEmail: varchar("participantEmail", { length: 320 }),
  joinedAt: timestamp("joinedAt"),
  leftAt: timestamp("leftAt"),
  durationMinutes: integer("durationMinutes"),
  attended: boolean("attended").default(false).notNull(),
  source: attendanceSourceEnum("source").default("teams").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type MeetingAttendance = typeof meetingAttendance.$inferSelect;
export type InsertMeetingAttendance = typeof meetingAttendance.$inferInsert;

// ─── Role Audit Log ────────────────────────────────────────────────────────────
export const roleAuditLog = pgTable("role_audit_log", {
  id: serial("id").primaryKey(),
  executorOpenId: varchar("executorOpenId", { length: 64 }).notNull(),
  executorName: varchar("executorName", { length: 256 }),
  targetOpenId: varchar("targetOpenId", { length: 64 }).notNull(),
  targetName: varchar("targetName", { length: 256 }),
  targetEmail: varchar("targetEmail", { length: 320 }),
  previousRole: varchar("previousRole", { length: 32 }),
  newRole: varchar("newRole", { length: 32 }).notNull(),
  reason: text("reason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RoleAuditLog = typeof roleAuditLog.$inferSelect;
export type InsertRoleAuditLog = typeof roleAuditLog.$inferInsert;

// ─── Password Reset Tokens ────────────────────────────────────────────────────
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

// ─── Ticket Alert Configs ─────────────────────────────────────────────────────
export const ticketAlertConfigs = pgTable("ticket_alert_configs", {
  id: serial("id").primaryKey(),
  domainId: integer("domainId").notNull().unique(),
  criticalDays: integer("criticalDays").default(3),
  highDays: integer("highDays").default(7),
  enabled: smallint("enabled").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type TicketAlertConfig = typeof ticketAlertConfigs.$inferSelect;
export type InsertTicketAlertConfig = typeof ticketAlertConfigs.$inferInsert;

export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value"),
  description: text("description"),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export const systemSettingsRelations = relations(systemSettings, ({}) => ({}));

// ─── Feedbacks ───────────────────────────────────────────────────────────────
export const feedbacks = pgTable("feedbacks", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: feedbackTypeEnum("type").notNull(),
  message: text("message").notNull(),
  status: feedbackStatusEnum("status").default("novo").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Feedback = typeof feedbacks.$inferSelect;
export type InsertFeedback = typeof feedbacks.$inferInsert;

// ─── Data Assets (Catálogo) ──────────────────────────────────────────────────
export const dataAssets = pgTable("data_assets", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  type: assetTypeEnum("type").notNull(),
  description: text("description"),
  region: varchar("region", { length: 64 }).default("Brasil"),
  domainId: integer("domainId"),
  ownerId: integer("ownerId"),
  stewardId: integer("stewardId"),
  sourceSystem: varchar("sourceSystem", { length: 128 }),
  sensitivity: sensitivityEnum("sensitivity").default("interno"),
  status: assetStatusEnum("status").default("ativo"),
  qualityScore: real("qualityScore").default(0),
  rowCount: integer("rowCount").default(0),
  lastSyncAt: timestamp("lastSyncAt"),
  businessArea: varchar("businessArea", { length: 128 }),
  criticality: criticalityEnum("criticality").default("media"),
  businessValueScore: real("businessValueScore").default(0),
  organizationId: integer("organizationId").default(1),
  fullyQualifiedName: varchar("fullyQualifiedName", { length: 512 }),
  // ─── Fluxo de Aprovação de Políticas PII ──────────────────────────────────
  piiPolicyStatus: piiPolicyStatusEnum("piiPolicyStatus"),
  piiPolicyReviewedBy: varchar("piiPolicyReviewedBy", { length: 256 }),
  piiPolicyReviewedAt: timestamp("piiPolicyReviewedAt"),
  piiPolicySyncedAt:   timestamp("piiPolicySyncedAt"),
  piiPolicyNotes:      text("piiPolicyNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type DataAsset = typeof dataAssets.$inferSelect;
export type InsertDataAsset = typeof dataAssets.$inferInsert;

// ─── Data Attributes (Dicionário) ────────────────────────────────────────────
export const dataAttributes = pgTable("data_attributes", {
  id: serial("id").primaryKey(),
  assetId: integer("assetId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  dataType: varchar("dataType", { length: 64 }),
  description: text("description"),
  businessRules: text("businessRules"),
  isPii: boolean("isPii").default(false),
  isKey: boolean("isKey").default(false),
  sampleValue: text("sampleValue"),
  isVerified: boolean("isVerified").default(false),
  verifiedBy: varchar("verifiedBy", { length: 256 }),
  verifiedAt: timestamp("verifiedAt"),
  aiSuggestion: text("aiSuggestion"),
  syncApproved: boolean("syncApproved").default(false),
  syncApprovedBy: varchar("syncApprovedBy", { length: 256 }),
  syncApprovedAt: timestamp("syncApprovedAt"),
  lastSyncedAt: timestamp("lastSyncedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type DataAttribute = typeof dataAttributes.$inferSelect;
export type InsertDataAttribute = typeof dataAttributes.$inferInsert;

// ─── Data Lineage (Linhagem) ─────────────────────────────────────────────────
export const dataLineage = pgTable("data_lineage", {
  id: serial("id").primaryKey(),
  sourceAssetId: integer("sourceAssetId").notNull(),
  targetAssetId: integer("targetAssetId").notNull(),
  transformationRule: text("transformationRule"),
  type: lineageTypeEnum("type").default("direto"),
  sourceColumn: varchar("sourceColumn", { length: 256 }),
  targetColumn: varchar("targetColumn", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DataLineage = typeof dataLineage.$inferSelect;
export type InsertDataLineage = typeof dataLineage.$inferInsert;

// ─── Data Quality Checks ─────────────────────────────────────────────────────
export const dataQualityChecks = pgTable("data_quality_checks", {
  id: serial("id").primaryKey(),
  assetId: integer("assetId").notNull(),
  metricName: varchar("metricName", { length: 128 }).notNull(),
  score: real("score").notNull(),
  threshold: real("threshold").default(95),
  lastRunAt: timestamp("lastRunAt").defaultNow(),
  status: qualityStatusEnum("status").notNull(),
  details: text("details"),
});

export type DataQualityCheck = typeof dataQualityChecks.$inferSelect;
export type InsertDataQualityCheck = typeof dataQualityChecks.$inferInsert;

// ─── Quality Rules (Configuração) ───────────────────────────────────────────
export const qualityRules = pgTable("quality_rules", {
  id: serial("id").primaryKey(),
  assetId: integer("assetId").notNull(),
  ruleType: qualityRuleTypeEnum("ruleType").notNull(),
  columnName: varchar("columnName", { length: 128 }),
  threshold: real("threshold").default(95),
  params: text("params"),
  customPattern: text("customPattern"),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type QualityRule = typeof qualityRules.$inferSelect;
export type InsertQualityRule = typeof qualityRules.$inferInsert;

// ─── Access Requests ─────────────────────────────────────────────────────────
export const accessRequests = pgTable("access_requests", {
  id: serial("id").primaryKey(),
  ticketNumber: varchar("ticketNumber", { length: 64 }).notNull(),
  assetId: integer("assetId").notNull(),
  requesterId: integer("requesterId"),
  requesterName: varchar("requesterName", { length: 256 }),
  requesterEmail: varchar("requesterEmail", { length: 320 }),
  nivelAcesso: accessNivelEnum("nivelAcesso").notNull(),
  papelGrupo: varchar("papelGrupo", { length: 256 }).notNull(),
  baseLegal: accessBaseLegalEnum("baseLegal").notNull(),
  finalidade: text("finalidade").notNull(),
  prazoNecessidade: varchar("prazoNecessidade", { length: 128 }),
  checklistJson: text("checklistJson"),
  envolveTerceiros: boolean("envolveTerceiros").default(false),
  statusOwner: accessStatusOwnerEnum("statusOwner").default("pendente"),
  ownerApprovedAt: timestamp("ownerApprovedAt"),
  ownerComment: text("ownerComment"),
  ownerId: integer("ownerId"),
  statusSteward: accessStatusStewardEnum("statusSteward").default("aguardando"),
  stewardApprovedAt: timestamp("stewardApprovedAt"),
  stewardComment: text("stewardComment"),
  stewardId: integer("stewardId"),
  status: accessStatusEnum("status").default("pendente_owner"),
  flowType: accessFlowTypeEnum("flowType").default("acesso_dados"),
  priority: priorityEnum("priority").default("media"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type AccessRequest = typeof accessRequests.$inferSelect;
export type InsertAccessRequest = typeof accessRequests.$inferInsert;

// ─── Organizations ────────────────────────────────────────────────────────────
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  appName: varchar("appName", { length: 128 }).default("Portal de Governança de Dados"),
  logoUrl: text("logoUrl"),
  faviconUrl: text("faviconUrl"),
  primaryColor: varchar("primaryColor", { length: 16 }).default("#1B3A8C"),
  secondaryColor: varchar("secondaryColor", { length: 16 }).default("#6DC23A"),
  customCss: text("customCss"),
  supportEmail: varchar("supportEmail", { length: 256 }),
  supportUrl: text("supportUrl"),
  termsUrl: text("termsUrl"),
  privacyUrl: text("privacyUrl"),
  plan: orgPlanEnum("plan").default("professional"),
  maxUsers: integer("maxUsers").default(50),
  maxAssets: integer("maxAssets").default(500),
  allowSso: boolean("allowSso").default(false),
  ssoMetadataUrl: text("ssoMetadataUrl"),
  defaultLocale: varchar("defaultLocale", { length: 8 }).default("pt-BR"),
  timezone: varchar("timezone", { length: 64 }).default("America/Sao_Paulo"),
  active: boolean("active").default(true),
  trialEndsAt: timestamp("trialEndsAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

// ─── Quality Score History ────────────────────────────────────────────────────
export const qualityScoreHistory = pgTable("quality_score_history", {
  id: serial("id").primaryKey(),
  assetId: integer("assetId").notNull(),
  score: integer("score").notNull(),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
  organizationId: integer("organizationId").default(1),
});

export type QualityScoreHistory = typeof qualityScoreHistory.$inferSelect;
export type InsertQualityScoreHistory = typeof qualityScoreHistory.$inferInsert;

// ─── Audit Log ───────────────────────────────────────────────────────────────
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  userId: integer("userId"),
  userEmail: varchar("userEmail", { length: 320 }),
  userName: varchar("userName", { length: 256 }),
  action: auditActionEnum("action").notNull(),
  entity: varchar("entity", { length: 64 }).notNull(),
  entityId: integer("entityId"),
  entityName: varchar("entityName", { length: 256 }),
  details: jsonb("details"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;

// ─── Business Glossary ────────────────────────────────────────────────────────
export const businessGlossary = pgTable("business_glossary", {
  id: serial("id").primaryKey(),
  term: varchar("term", { length: 256 }).notNull(),
  definition: text("definition").notNull(),
  abbreviation: varchar("abbreviation", { length: 64 }),
  domainId: integer("domainId"),
  ownerId: integer("ownerId"),
  status: glossaryStatusEnum("status").default("rascunho"),
  category: varchar("category", { length: 128 }),
  synonyms: text("synonyms"),
  examples: text("examples"),
  notes: text("notes"),
  relatedTermIds: text("relatedTermIds"),
  approvedBy: varchar("approvedBy", { length: 256 }),
  approvedAt: timestamp("approvedAt"),
  createdById: integer("createdById"),
  createdByName: varchar("createdByName", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type BusinessGlossaryTerm = typeof businessGlossary.$inferSelect;
export type InsertBusinessGlossaryTerm = typeof businessGlossary.$inferInsert;

// ─── SLA de Dados ─────────────────────────────────────────────────────────────
export const slaConfigs = pgTable("sla_configs", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  entityType: slaEntityTypeEnum("entityType").notNull().default("global"),
  entityId: integer("entityId"),
  maxUpdateDays: integer("maxUpdateDays").default(30),
  minQualityScore: real("minQualityScore").default(70),
  maxAccessResponseDays: integer("maxAccessResponseDays").default(5),
  alertEmails: text("alertEmails"),
  alertOnBreachOnly: boolean("alertOnBreachOnly").default(true),
  active: boolean("active").notNull().default(true),
  createdById: integer("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type SlaConfig = typeof slaConfigs.$inferSelect;
export type InsertSlaConfig = typeof slaConfigs.$inferInsert;

export const slaViolations = pgTable("sla_violations", {
  id: serial("id").primaryKey(),
  slaConfigId: integer("slaConfigId").notNull(),
  entityType: slaViolEntityEnum("entityType").notNull(),
  entityId: integer("entityId").notNull(),
  entityName: varchar("entityName", { length: 256 }),
  violationType: slaViolTypeEnum("violationType").notNull(),
  daysOverdue: integer("daysOverdue").default(0),
  notificationSent: boolean("notificationSent").default(false),
  details: jsonb("details"),
  resolvedAt: timestamp("resolvedAt"),
  detectedAt: timestamp("detectedAt").defaultNow().notNull(),
});

export type SlaViolation = typeof slaViolations.$inferSelect;
export type InsertSlaViolation = typeof slaViolations.$inferInsert;

// ─── Webhooks ─────────────────────────────────────────────────────────────────
export const webhookConfigs = pgTable("webhook_configs", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  url: text("url").notNull(),
  secret: varchar("secret", { length: 256 }),
  events: jsonb("events").notNull(),
  active: boolean("active").notNull().default(true),
  failureCount: integer("failureCount").default(0),
  lastTriggeredAt: timestamp("lastTriggeredAt"),
  lastStatusCode: integer("lastStatusCode"),
  createdById: integer("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type WebhookConfig = typeof webhookConfigs.$inferSelect;
export type InsertWebhookConfig = typeof webhookConfigs.$inferInsert;

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: serial("id").primaryKey(),
  webhookConfigId: integer("webhookConfigId").notNull(),
  event: varchar("event", { length: 128 }).notNull(),
  payload: jsonb("payload").notNull(),
  statusCode: integer("statusCode"),
  responseBody: text("responseBody"),
  success: boolean("success").default(false),
  attemptCount: integer("attemptCount").default(1),
  deliveredAt: timestamp("deliveredAt").defaultNow().notNull(),
});

export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type InsertWebhookDelivery = typeof webhookDeliveries.$inferInsert;

// ─── SSO Config ───────────────────────────────────────────────────────────────
export const ssoConfigs = pgTable("sso_configs", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId").notNull().unique(),
  provider: ssoProviderEnum("provider").notNull().default("saml"),
  entryPoint: text("entryPoint"),
  issuer: varchar("issuer", { length: 512 }),
  certificate: text("certificate"),
  callbackUrl: text("callbackUrl"),
  clientId: varchar("clientId", { length: 512 }),
  clientSecret: text("clientSecret"),
  discoveryUrl: text("discoveryUrl"),
  active: boolean("active").notNull().default(false),
  lastTestedAt: timestamp("lastTestedAt"),
  lastTestSuccess: boolean("lastTestSuccess"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type SsoConfig = typeof ssoConfigs.$inferSelect;
export type InsertSsoConfig = typeof ssoConfigs.$inferInsert;

// ─── API Keys ─────────────────────────────────────────────────────────────────
export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  keyHash: varchar("keyHash", { length: 256 }).notNull().unique(),
  keyPrefix: varchar("keyPrefix", { length: 8 }).notNull(),
  scopes: jsonb("scopes").notNull(),
  active: boolean("active").notNull().default(true),
  lastUsedAt: timestamp("lastUsedAt"),
  expiresAt: timestamp("expiresAt"),
  createdById: integer("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

// ─── Data Contracts ───────────────────────────────────────────────────────────
export const dataContracts = pgTable("data_contracts", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  assetId: integer("assetId").notNull(),
  producerTeam: varchar("producerTeam", { length: 256 }).notNull(),
  consumerTeam: varchar("consumerTeam", { length: 256 }).notNull(),
  description: text("description"),
  slaLevel: text("slaLevel"),
  schemaJson: jsonb("schemaJson"),
  deliveryFrequency: varchar("deliveryFrequency", { length: 128 }),
  version: varchar("version", { length: 32 }).default("1.0.0"),
  status: contractStatusEnum("status").default("rascunho").notNull(),
  signedAt: timestamp("signedAt"),
  expiresAt: timestamp("expiresAt"),
  createdById: integer("createdById"),
  createdByName: varchar("createdByName", { length: 256 }),
  approvedById: integer("approvedById"),
  approvedByName: varchar("approvedByName", { length: 256 }),
  changeNotes: text("changeNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type DataContract = typeof dataContracts.$inferSelect;
export type InsertDataContract = typeof dataContracts.$inferInsert;

// ─── PIA / DPIA Assessments ───────────────────────────────────────────────────
export const piaAssessments = pgTable("pia_assessments", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 256 }).notNull(),
  assetId: integer("assetId"),
  assetName: varchar("assetName", { length: 256 }),
  status: piaStatusEnum("status").default("rascunho").notNull(),
  riskLevel: piaRiskEnum("riskLevel"),
  dataCategories: jsonb("dataCategories"),
  purposes: text("purposes"),
  legalBasis: varchar("legalBasis", { length: 128 }),
  retentionPeriod: varchar("retentionPeriod", { length: 128 }),
  crossBorderTransfer: boolean("crossBorderTransfer").default(false),
  thirdPartySharing: boolean("thirdPartySharing").default(false),
  automatedDecision: boolean("automatedDecision").default(false),
  mitigationMeasures: text("mitigationMeasures"),
  residualRisk: text("residualRisk"),
  dpoRecommendation: text("dpoRecommendation"),
  createdById: integer("createdById"),
  createdByName: varchar("createdByName", { length: 256 }),
  reviewedById: integer("reviewedById"),
  reviewedByName: varchar("reviewedByName", { length: 256 }),
  approvedAt: timestamp("approvedAt"),
  reviewNotes: text("reviewNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type PiaAssessment = typeof piaAssessments.$inferSelect;
export type InsertPiaAssessment = typeof piaAssessments.$inferInsert;

// ─── DSAR ─────────────────────────────────────────────────────────────────────
export const dsarRequests = pgTable("dsar_requests", {
  id: serial("id").primaryKey(),
  requestType: dsarTypeEnum("requestType").notNull(),
  status: dsarStatusEnum("status").default("aberto").notNull(),
  subjectName: varchar("subjectName", { length: 256 }).notNull(),
  subjectEmail: varchar("subjectEmail", { length: 320 }).notNull(),
  subjectDocument: varchar("subjectDocument", { length: 64 }),
  description: text("description"),
  internalNotes: text("internalNotes"),
  responseDetails: text("responseDetails"),
  assignedToId: integer("assignedToId"),
  assignedToName: varchar("assignedToName", { length: 256 }),
  deadline: timestamp("deadline"),
  closedAt: timestamp("closedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type DsarRequest = typeof dsarRequests.$inferSelect;
export type InsertDsarRequest = typeof dsarRequests.$inferInsert;

// ─── Connector Configs ────────────────────────────────────────────────────────
export const connectorConfigs = pgTable("connector_configs", {
  id: serial("id").primaryKey(),
  connectorType: varchar("connectorType", { length: 64 }).notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  configJson: jsonb("configJson").notNull(),
  active: boolean("active").notNull().default(true),
  lastTestedAt: timestamp("lastTestedAt"),
  lastTestSuccess: boolean("lastTestSuccess"),
  lastTestMessage: text("lastTestMessage"),
  createdById: integer("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type ConnectorConfig = typeof connectorConfigs.$inferSelect;
export type InsertConnectorConfig = typeof connectorConfigs.$inferInsert;

// ─── Data Quality History ─────────────────────────────────────────────────────
export const dataQualityHistory = pgTable("data_quality_history", {
  id: serial("id").primaryKey(),
  assetId: integer("assetId").notNull(),
  avgScore: real("avgScore").notNull(),
  checksPassed: integer("checksPassed").default(0),
  checksTotal: integer("checksTotal").default(0),
  organizationId: integer("organizationId").default(1),
  measuredAt: timestamp("measuredAt").defaultNow().notNull(),
});

export type DataQualityHistory = typeof dataQualityHistory.$inferSelect;
export type InsertDataQualityHistory = typeof dataQualityHistory.$inferInsert;

// ─── Workflow Engine ──────────────────────────────────────────────────────────
export const workflowDefinitions = pgTable("workflow_definitions", {
  id: serial("id").primaryKey(),
  orgId: integer("orgId").notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  stepsJson: jsonb("stepsJson").notNull(),
  triggerEntityType: varchar("triggerEntityType", { length: 64 }).notNull().default("asset"),
  autoTrigger: boolean("autoTrigger").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type WorkflowDefinition = typeof workflowDefinitions.$inferSelect;
export type InsertWorkflowDefinition = typeof workflowDefinitions.$inferInsert;

export const workflowInstances = pgTable("workflow_instances", {
  id: serial("id").primaryKey(),
  definitionId: integer("definitionId").notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: integer("entityId").notNull(),
  currentStep: integer("currentStep").notNull().default(0),
  status: workflowStatusEnum("status").notNull().default("pending"),
  initiatorOpenId: varchar("initiatorOpenId", { length: 128 }).notNull(),
  contextJson: jsonb("contextJson"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type WorkflowInstance = typeof workflowInstances.$inferSelect;
export type InsertWorkflowInstance = typeof workflowInstances.$inferInsert;

export const workflowStepActions = pgTable("workflow_step_actions", {
  id: serial("id").primaryKey(),
  instanceId: integer("instanceId").notNull(),
  stepIndex: integer("stepIndex").notNull(),
  actorOpenId: varchar("actorOpenId", { length: 128 }).notNull(),
  actorName: varchar("actorName", { length: 256 }),
  decision: workflowDecisionEnum("decision").notNull(),
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WorkflowStepAction = typeof workflowStepActions.$inferSelect;
export type InsertWorkflowStepAction = typeof workflowStepActions.$inferInsert;

// ─── Asset Comments ───────────────────────────────────────────────────────────
export const assetComments = pgTable("asset_comments", {
  id: serial("id").primaryKey(),
  assetId: integer("assetId").notNull(),
  userId: integer("userId").notNull(),
  userName: varchar("userName", { length: 256 }).notNull(),
  content: text("content").notNull(),
  parentId: integer("parentId"),
  resolved: smallint("resolved").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type AssetComment = typeof assetComments.$inferSelect;
export type InsertAssetComment = typeof assetComments.$inferInsert;

// ─── Intake de Demandas ───────────────────────────────────────────────────────
export const intakeRequests = pgTable("intake_requests", {
  id: serial("id").primaryKey(),
  intakeCode: varchar("intakeCode", { length: 32 }),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description").notNull(),
  type: intakeTypeEnum("type").notNull(),
  priority: intakePriorityEnum("priority").default("media").notNull(),
  desiredDeadline: varchar("desiredDeadline", { length: 64 }),
  submittedById: integer("submittedById"),
  submitterName: varchar("submitterName", { length: 256 }),
  submitterEmail: varchar("submitterEmail", { length: 320 }),
  submitterDept: varchar("submitterDept", { length: 128 }),
  problemStatement: text("problemStatement"),
  objective: text("objective"),
  targetAudience: text("targetAudience"),
  usageFrequency: varchar("usageFrequency", { length: 128 }),
  financialImpact: text("financialImpact"),
  businessImpact: text("businessImpact"),
  technicalImpact: text("technicalImpact"),
  sourceSystems: text("sourceSystems"),
  mainEntities: text("mainEntities"),
  estimatedVolume: varchar("estimatedVolume", { length: 128 }),
  updateFrequency: varchar("updateFrequency", { length: 128 }),
  historyNeeded: varchar("historyNeeded", { length: 128 }),
  containsPii: containsPiiEnum("containsPii"),
  piiColumns: text("piiColumns"),
  expectedFields: text("expectedFields"),
  qualityCriteria: jsonb("qualityCriteria").$type<Array<{
    dimension: string; affectedField: string; rule: string; blocksPipeline: boolean;
  }>>(),
  minDqScore: real("minDqScore"),
  dqFailAction: varchar("dqFailAction", { length: 64 }),
  successCriteria: jsonb("successCriteria").$type<Array<{
    criterion: string; kpi: string; goal: string;
  }>>(),
  postDeliveryMeasurement: text("postDeliveryMeasurement"),
  dataOwnerName: varchar("dataOwnerName", { length: 256 }),
  dataStewardName: varchar("dataStewardName", { length: 256 }),
  privacyChampion: varchar("privacyChampion", { length: 256 }),
  dataSensitivity: dataSensitivityEnum("dataSensitivity"),
  accessGroups: text("accessGroups"),
  applicableRegulations: varchar("applicableRegulations", { length: 256 }),
  retentionPeriod: varchar("retentionPeriod", { length: 128 }),
  technicalDependencies: text("technicalDependencies"),
  identifiedRisks: text("identifiedRisks"),
  relatedDemands: varchar("relatedDemands", { length: 256 }),
  testEnvironmentAvailable: varchar("testEnvironmentAvailable", { length: 128 }),
  networkInfraNeeded: varchar("networkInfraNeeded", { length: 128 }),
  managerApproval: varchar("managerApproval", { length: 256 }),
  domainId: integer("domainId"),
  assetId: integer("assetId"),
  status: intakeStatusEnum("status").default("submetido").notNull(),
  reviewedById: integer("reviewedById"),
  reviewedByName: varchar("reviewedByName", { length: 256 }),
  reviewedAt: timestamp("reviewedAt"),
  reviewNotes: text("reviewNotes"),
  returnReason: text("returnReason"),
  impactScore: integer("impactScore"),
  effortScore: integer("effortScore"),
  scoringNotes: text("scoringNotes"),
  scoreFinancialImpact:      smallint("scoreFinancialImpact"),
  scoreBusinessUrgency:      smallint("scoreBusinessUrgency"),
  scoreReach:                smallint("scoreReach"),
  scoreStrategicAlignment:   smallint("scoreStrategicAlignment"),
  scoreIntakeCompleteness:   smallint("scoreIntakeCompleteness"),
  scoreTechnicalFeasibility: smallint("scoreTechnicalFeasibility"),
  scoreReuse:                smallint("scoreReuse"),
  scoreDataOwnerDefined:     smallint("scoreDataOwnerDefined"),
  totalScore:                integer("totalScore"),
  priorityTier:              priorityTierEnum("priorityTier"),
  triageChecklist: jsonb("triageChecklist").$type<{
    completeness: boolean[];
    viability: boolean[];
    governance: boolean[];
    result?: "aprovado" | "devolvido" | "recusado";
  }>(),
  executorId: integer("executorId"),
  executorName: varchar("executorName", { length: 256 }),
  executionStartedAt: timestamp("executionStartedAt"),
  executionNotes: text("executionNotes"),
  deliveredAt: timestamp("deliveredAt"),
  validatedAt: timestamp("validatedAt"),
  validatedById: integer("validatedById"),
  validatedByName: varchar("validatedByName", { length: 256 }),
  deliveryNotes: text("deliveryNotes"),
  relatedMeetingId: integer("relatedMeetingId"),
  agendaItemId: integer("agendaItemId"),
  externalTicketId: varchar("externalTicketId", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type IntakeRequest = typeof intakeRequests.$inferSelect;
export type InsertIntakeRequest = typeof intakeRequests.$inferInsert;

// ─── Tag Policies ─────────────────────────────────────────────────────────────
export const tagPolicies = pgTable("tag_policies", {
  id: serial("id").primaryKey(),
  tagKey: varchar("tagKey", { length: 256 }).notNull().unique(),
  displayName: varchar("displayName", { length: 256 }).notNull(),
  description: text("description"),
  allowedValues: text("allowedValues").notNull().default("[]"),
  colorMap: text("colorMap").default("{}"),
  appliesTo: tagAppliesToEnum("appliesTo").notNull().default("both"),
  category: varchar("category", { length: 128 }).default("compliance"),
  isRequired: boolean("isRequired").default(false),
  autoSync: boolean("autoSync").default(false),
  sensitivityMapping: text("sensitivityMapping").default("{}"),
  createdById: integer("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type TagPolicy = typeof tagPolicies.$inferSelect;
export type InsertTagPolicy = typeof tagPolicies.$inferInsert;

// ─── Tier Sync Log ────────────────────────────────────────────────────────────
export const tierSyncLog = pgTable("tier_sync_log", {
  id:              serial("id").primaryKey(),
  domainId:        integer("domainId").notNull(),
  domainName:      varchar("domainName", { length: 256 }).notNull(),
  tierLevel:       integer("tierLevel").notNull(),
  action:          varchar("action", { length: 64 }).notNull(),
  databricksGroup: varchar("databricksGroup", { length: 256 }),
  catalog:         varchar("catalog", { length: 256 }),
  schema:          varchar("schema", { length: 256 }),
  appliedCount:    integer("appliedCount").default(0),
  failedCount:     integer("failedCount").default(0),
  skippedCount:    integer("skippedCount").default(0),
  results:         jsonb("results").$type<Array<{
    operation: string; target: string; privilege: string;
    principal: string; ok: boolean; error?: string;
  }>>(),
  performedBy:     varchar("performedBy", { length: 320 }),
  syncedAt:        timestamp("syncedAt").defaultNow().notNull(),
});
export type TierSyncLog = typeof tierSyncLog.$inferSelect;
export type InsertTierSyncLog = typeof tierSyncLog.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════════
// LACUNAS LUCID DATA GOVERNANCE — feat/Lucid_Data_Governance
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Enums: MLOps ─────────────────────────────────────────────────────────────
export const modelStatusEnum    = pgEnum("model_status",    ["development", "staging", "production", "deprecated", "archived"]);
export const modelTypeEnum      = pgEnum("model_type",      ["classification", "regression", "nlp", "llm", "computer_vision", "clustering", "other"]);
export const driftStatusEnum    = pgEnum("drift_status",    ["ok", "warning", "critical"]);
export const modelFrameworkEnum = pgEnum("model_framework", ["sklearn", "pytorch", "tensorflow", "xgboost", "lightgbm", "huggingface", "openai", "other"]);

// ─── Enums: AI Risk ───────────────────────────────────────────────────────────
export const riskLevelEnum      = pgEnum("risk_level",      ["baixo", "medio", "alto", "critico"]);
export const riskCategoryEnum   = pgEnum("risk_category",   ["vies", "privacidade", "seguranca", "explicabilidade", "conformidade", "operacional"]);
export const riskStatusEnum     = pgEnum("risk_status",     ["aberto", "em_mitigacao", "mitigado", "aceito"]);
export const complianceFrameworkEnum = pgEnum("compliance_framework", ["lgpd", "eu_ai_act", "iso_42001", "nist_ai_rmf"]);

// ─── Enums: Integrações BI/SAP ────────────────────────────────────────────────
export const biConnectorTypeEnum = pgEnum("bi_connector_type", ["powerbi", "sap", "databricks", "tableau", "looker", "other"]);
export const syncStatusEnum      = pgEnum("sync_status",       ["idle", "running", "success", "error"]);

// ─── MLOps: Registro de Modelos ───────────────────────────────────────────────
export const mlModels = pgTable("ml_models", {
  id:             serial("id").primaryKey(),
  name:           varchar("name", { length: 256 }).notNull(),
  version:        varchar("version", { length: 64 }).notNull().default("1.0.0"),
  description:    text("description"),
  modelType:      modelTypeEnum("model_type").notNull().default("classification"),
  framework:      modelFrameworkEnum("framework").notNull().default("sklearn"),
  status:         modelStatusEnum("status").notNull().default("development"),
  domainId:       integer("domain_id"),
  ownerId:        integer("owner_id"),
  ownerName:      varchar("owner_name", { length: 256 }),
  accuracyScore:  real("accuracy_score"),
  f1Score:        real("f1_score"),
  aucScore:       real("auc_score"),
  precisionScore: real("precision_score"),
  recallScore:    real("recall_score"),
  driftScore:     real("drift_score").default(0),
  driftStatus:    driftStatusEnum("drift_status").default("ok"),
  lastDriftCheck: timestamp("last_drift_check"),
  artifactUri:    text("artifact_uri"),
  experimentId:   varchar("experiment_id", { length: 256 }),
  runId:          varchar("run_id", { length: 256 }),
  gitCommit:      varchar("git_commit", { length: 64 }),
  tags:           jsonb("tags").$type<string[]>().default([]),
  inputSchema:    jsonb("input_schema").$type<Record<string, string>>(),
  outputSchema:   jsonb("output_schema").$type<Record<string, string>>(),
  deployedAt:     timestamp("deployed_at"),
  deprecatedAt:   timestamp("deprecated_at"),
  createdById:    integer("created_by_id"),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
  updatedAt:      timestamp("updated_at").defaultNow().notNull(),
});
export type MlModel = typeof mlModels.$inferSelect;
export type InsertMlModel = typeof mlModels.$inferInsert;

// ─── MLOps: Histórico de Métricas ─────────────────────────────────────────────
export const mlModelMetrics = pgTable("ml_model_metrics", {
  id:              serial("id").primaryKey(),
  modelId:         integer("model_id").notNull(),
  accuracy:        real("accuracy"),
  f1Score:         real("f1_score"),
  aucScore:        real("auc_score"),
  driftScore:      real("drift_score"),
  predictionCount: integer("prediction_count").default(0),
  errorRate:       real("error_rate").default(0),
  latencyP99Ms:    integer("latency_p99_ms"),
  recordedAt:      timestamp("recorded_at").defaultNow().notNull(),
});
export type MlModelMetric = typeof mlModelMetrics.$inferSelect;
export type InsertMlModelMetric = typeof mlModelMetrics.$inferInsert;

// ─── MLOps: Log de Predições ──────────────────────────────────────────────────
export const mlPredictionLogs = pgTable("ml_prediction_logs", {
  id:          serial("id").primaryKey(),
  modelId:     integer("model_id").notNull(),
  inputHash:   varchar("input_hash", { length: 64 }),
  outputLabel: text("output_label"),
  confidence:  real("confidence"),
  latencyMs:   integer("latency_ms"),
  userId:      integer("user_id"),
  requestId:   varchar("request_id", { length: 128 }),
  flagged:     boolean("flagged").default(false),
  flagReason:  text("flag_reason"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});
export type MlPredictionLog = typeof mlPredictionLogs.$inferSelect;

// ─── AI Risk: Avaliações de Risco ─────────────────────────────────────────────
export const aiRiskAssessments = pgTable("ai_risk_assessments", {
  id:              serial("id").primaryKey(),
  modelId:         integer("model_id"),
  modelName:       varchar("model_name", { length: 256 }).notNull(),
  title:           varchar("title", { length: 512 }).notNull(),
  description:     text("description"),
  category:        riskCategoryEnum("category").notNull(),
  level:           riskLevelEnum("level").notNull().default("medio"),
  status:          riskStatusEnum("status").notNull().default("aberto"),
  probability:     smallint("probability").default(3),
  impact:          smallint("impact").default(3),
  riskScore:       integer("risk_score"),
  xaiMethod:       varchar("xai_method", { length: 64 }),
  xaiSummary:      text("xai_summary"),
  biasMetric:      real("bias_metric"),
  biasThreshold:   real("bias_threshold"),
  mitigationPlan:  text("mitigation_plan"),
  mitigationDueAt: timestamp("mitigation_due_at"),
  mitigatedAt:     timestamp("mitigated_at"),
  mitigatedById:   integer("mitigated_by_id"),
  ownerId:         integer("owner_id"),
  ownerName:       varchar("owner_name", { length: 256 }),
  reviewerId:      integer("reviewer_id"),
  reviewerName:    varchar("reviewer_name", { length: 256 }),
  createdById:     integer("created_by_id"),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
  updatedAt:       timestamp("updated_at").defaultNow().notNull(),
});
export type AiRiskAssessment = typeof aiRiskAssessments.$inferSelect;
export type InsertAiRiskAssessment = typeof aiRiskAssessments.$inferInsert;

// ─── AI Risk: Conformidade Regulatória ────────────────────────────────────────
export const aiComplianceChecks = pgTable("ai_compliance_checks", {
  id:           serial("id").primaryKey(),
  modelId:      integer("model_id"),
  modelName:    varchar("model_name", { length: 256 }).notNull(),
  framework:    complianceFrameworkEnum("framework").notNull(),
  checkName:    varchar("check_name", { length: 256 }).notNull(),
  description:  text("description"),
  passed:       boolean("passed").notNull().default(false),
  evidence:     text("evidence"),
  notes:        text("notes"),
  checkedById:  integer("checked_by_id"),
  checkedAt:    timestamp("checked_at").defaultNow().notNull(),
  nextReviewAt: timestamp("next_review_at"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});
export type AiComplianceCheck = typeof aiComplianceChecks.$inferSelect;
export type InsertAiComplianceCheck = typeof aiComplianceChecks.$inferInsert;

// ─── AI Risk: Histórico de Score ──────────────────────────────────────────────
export const aiRiskHistory = pgTable("ai_risk_history", {
  id:            serial("id").primaryKey(),
  modelId:       integer("model_id"),
  modelName:     varchar("model_name", { length: 256 }).notNull(),
  riskScore:     integer("risk_score").notNull(),
  openCount:     integer("open_count").default(0),
  criticalCount: integer("critical_count").default(0),
  recordedAt:    timestamp("recorded_at").defaultNow().notNull(),
});
export type AiRiskHistory = typeof aiRiskHistory.$inferSelect;

// ─── Integrações BI/SAP: Conectores ───────────────────────────────────────────
export const biConnectors = pgTable("bi_connectors", {
  id:             serial("id").primaryKey(),
  name:           varchar("name", { length: 256 }).notNull(),
  type:           biConnectorTypeEnum("type").notNull(),
  description:    text("description"),
  endpointUrl:    text("endpoint_url"),
  workspaceId:    varchar("workspace_id", { length: 256 }),
  datasetId:      varchar("dataset_id", { length: 256 }),
  reportId:       varchar("report_id", { length: 256 }),
  authMethod:     varchar("auth_method", { length: 64 }).default("oauth2"),
  isActive:       boolean("is_active").default(true),
  lastSyncAt:     timestamp("last_sync_at"),
  lastSyncStatus: syncStatusEnum("last_sync_status").default("idle"),
  lastSyncError:  text("last_sync_error"),
  syncCount:      integer("sync_count").default(0),
  config:         jsonb("config").$type<Record<string, unknown>>().default({}),
  createdById:    integer("created_by_id"),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
  updatedAt:      timestamp("updated_at").defaultNow().notNull(),
});
export type BiConnector = typeof biConnectors.$inferSelect;
export type InsertBiConnector = typeof biConnectors.$inferInsert;

// ─── Integrações BI/SAP: Log de Sincronizações ────────────────────────────────
export const biSyncLogs = pgTable("bi_sync_logs", {
  id:            serial("id").primaryKey(),
  connectorId:   integer("connector_id").notNull(),
  connectorName: varchar("connector_name", { length: 256 }),
  status:        syncStatusEnum("status").notNull(),
  recordsSent:   integer("records_sent").default(0),
  durationMs:    integer("duration_ms"),
  payload:       jsonb("payload").$type<Record<string, unknown>>(),
  errorMessage:  text("error_message"),
  triggeredById: integer("triggered_by_id"),
  startedAt:     timestamp("started_at").defaultNow().notNull(),
  finishedAt:    timestamp("finished_at"),
});
export type BiSyncLog = typeof biSyncLogs.$inferSelect;


// ═══════════════════════════════════════════════════════════════════════════
// HUB AI & Data (Nexa Playbook): Gates G0-G4, Business Case, Artefatos
// ═══════════════════════════════════════════════════════════════════════════

export const gateNameEnum     = pgEnum("gate_name",      ["G0", "G1", "G2", "G3", "G4"]);
export const gateDecisionEnum = pgEnum("gate_decision",  ["go", "no_go", "pendente"]);
export const artifactTypeEnum = pgEnum("artifact_type",  ["ficha_hipotese","business_case","risk_assessment","checklist_arquitetura","checklist_compliance","status_report","uat_doc","gmud","handover","knowledge_transfer","outro"]);
export const lifecyclePhaseEnum = pgEnum("lifecycle_phase", ["descoberta_problema","descoberta_hipoteses","avaliacao_hipotese","poc","desenvolvimento_testes","uat","habilitacao_operacional","hypercare","lancamento_operacional","sustentacao"]);

// ─── HUB: Histórico de Gates (G0-G4) por demanda ─────────────────────────────
export const intakeGatesHistory = pgTable("intake_gates_history", {
  id:           serial("id").primaryKey(),
  intakeId:     integer("intake_id").notNull(),
  gateName:     gateNameEnum("gate_name").notNull(),
  decision:     gateDecisionEnum("decision").notNull().default("pendente"),
  criteriaMet:  jsonb("criteria_met").$type<{
    impactosRiscos?: boolean;
    potencialFinanceiro?: boolean;
    viabilidadeOperacional?: boolean;
    viabilidadeTecnica?: boolean;
  }>(),
  approvedById: integer("approved_by_id"),
  approvedByName: varchar("approved_by_name", { length: 256 }),
  decidedAt:    timestamp("decided_at"),
  comments:     text("comments"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});
export type IntakeGateHistory = typeof intakeGatesHistory.$inferSelect;
export type InsertIntakeGateHistory = typeof intakeGatesHistory.$inferInsert;

// ─── HUB: Fase do ciclo de vida por demanda ───────────────────────────────────
export const intakeLifecycle = pgTable("intake_lifecycle", {
  id:          serial("id").primaryKey(),
  intakeId:    integer("intake_id").notNull().unique(),
  phase:       lifecyclePhaseEnum("phase").notNull().default("descoberta_problema"),
  phaseHistory: jsonb("phase_history").$type<Array<{
    phase: string; enteredAt: string; exitedAt?: string; changedBy?: string;
  }>>().default([]),
  hypercareStartedAt: timestamp("hypercare_started_at"),
  hypercareExitCriteria: jsonb("hypercare_exit_criteria").$type<Array<{
    criterion: string; met: boolean; verifiedAt?: string;
  }>>(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
});
export type IntakeLifecycle = typeof intakeLifecycle.$inferSelect;
export type InsertIntakeLifecycle = typeof intakeLifecycle.$inferInsert;

// ─── HUB: Business Case (Calculadora ROI / CAPEX / OPEX) ─────────────────────
export const intakeBusinessCase = pgTable("intake_business_case", {
  id:                  serial("id").primaryKey(),
  intakeId:            integer("intake_id").notNull().unique(),
  // Projeção de Ganhos (Bloco F do template Nexa)
  reducesFte:          boolean("reduces_fte").default(false),
  reducesFteValue:     real("reduces_fte_value"),
  avoidsInfraCosts:    boolean("avoids_infra_costs").default(false),
  avoidsInfraValue:    real("avoids_infra_value"),
  avoidsPenalties:     boolean("avoids_penalties").default(false),
  avoidsPenaltiesValue: real("avoids_penalties_value"),
  avoidsFutureCosts:   boolean("avoids_future_costs").default(false),
  avoidsFutureValue:   real("avoids_future_value"),
  increasesEfficiency: boolean("increases_efficiency").default(false),
  efficiencyValue:     real("efficiency_value"),
  intangibleBenefits:  text("intangible_benefits"),
  // Calculadora CAPEX/OPEX
  capexTotal:          real("capex_total"),
  opexMonthly:         real("opex_monthly"),
  opexAnnual:          real("opex_annual"),
  estimatedRoiMonths:  integer("estimated_roi_months"),
  componentsCost:      jsonb("components_cost").$type<Array<{
    component: string; billingType: string; monthlyVolume: string; unitCost: number; isCapex: boolean;
  }>>().default([]),
  // Priorização (framework slide 121)
  scoreDataReadiness:  smallint("score_data_readiness"),
  scoreTechReadiness:  smallint("score_tech_readiness"),
  scoreMaintenance:    smallint("score_maintenance"),
  scoreOrgReadiness:   smallint("score_org_readiness"),
  scoreTimeline:       smallint("score_timeline"),
  scoreStrategicValue: smallint("score_strategic_value"),
  scoreValueImpact:    smallint("score_value_impact"),
  scoreReusability:    smallint("score_reusability"),
  scoreRiskProbability: smallint("score_risk_probability"),
  scoreSecurity:       smallint("score_security"),
  scoreRiskImpact:     smallint("score_risk_impact"),
  createdById:         integer("created_by_id"),
  createdAt:           timestamp("created_at").defaultNow().notNull(),
  updatedAt:           timestamp("updated_at").defaultNow().notNull(),
});
export type IntakeBusinessCase = typeof intakeBusinessCase.$inferSelect;
export type InsertIntakeBusinessCase = typeof intakeBusinessCase.$inferInsert;

// ─── HUB: Artefatos obrigatórios por Gate (Risk Assessment, GMUD, etc.) ──────
export const intakeArtifacts = pgTable("intake_artifacts", {
  id:            serial("id").primaryKey(),
  intakeId:      integer("intake_id").notNull(),
  artifactType:  artifactTypeEnum("artifact_type").notNull(),
  title:         varchar("title", { length: 512 }).notNull(),
  fileUrl:       text("file_url"),
  fileName:      varchar("file_name", { length: 512 }),
  fileSizeBytes: integer("file_size_bytes"),
  mimeType:      varchar("mime_type", { length: 128 }),
  version:       integer("version").default(1).notNull(),
  notes:         text("notes"),
  uploadedById:  integer("uploaded_by_id"),
  uploadedByName: varchar("uploaded_by_name", { length: 256 }),
  uploadedAt:    timestamp("uploaded_at").defaultNow().notNull(),
});
export type IntakeArtifact = typeof intakeArtifacts.$inferSelect;
export type InsertIntakeArtifact = typeof intakeArtifacts.$inferInsert;
