import { eq, desc, asc, and, or, sql, count, isNotNull, isNull, gte, lte, getTableColumns, like } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { createHmac, createHash, randomBytes } from "crypto";
import {
  InsertUser, users,
  domains, InsertDomain,
  participants, InsertParticipant,
  meetings, InsertMeeting,
  agendaItems, InsertAgendaItem,
  invites, InsertInvite,
  raciMatrix, InsertRaciMatrix,
  implementationChecklist, InsertImplementationChecklist,
  aiChatHistory, InsertAiChatHistory,
  servicenowTickets, InsertServicenowTicket,
  emailNotifications, InsertEmailNotification,
  notificationPreferences, InsertNotificationPreference,
  exportHistory, InsertExportHistory,
  meetingAttendance, InsertMeetingAttendance, MeetingAttendance,
  ticketAlertConfigs, InsertTicketAlertConfig,
  feedbacks, InsertFeedback,
  dataAssets, InsertDataAsset,
  dataAttributes, InsertDataAttribute,
  dataLineage, InsertDataLineage,
  dataQualityChecks, InsertDataQualityCheck,
  accessRequests, InsertAccessRequest, AccessRequest,
  qualityRules, InsertQualityRule,
  auditLog, InsertAuditLog,
  businessGlossary, InsertBusinessGlossaryTerm,
  organizations, InsertOrganization,
  slaConfigs, InsertSlaConfig, slaViolations, InsertSlaViolation,
  webhookConfigs, InsertWebhookConfig, webhookDeliveries, InsertWebhookDelivery,
  ssoConfigs, InsertSsoConfig,
  apiKeys, InsertApiKey,
  dataContracts, InsertDataContract, DataContract,
  piaAssessments, InsertPiaAssessment,
  dsarRequests, InsertDsarRequest,
  connectorConfigs, InsertConnectorConfig,
  dataQualityHistory, InsertDataQualityHistory,
  workflowDefinitions, InsertWorkflowDefinition, WorkflowDefinition,
  workflowInstances, InsertWorkflowInstance, WorkflowInstance,
  workflowStepActions, InsertWorkflowStepAction,
  assetComments, InsertAssetComment, AssetComment,
  intakeRequests, InsertIntakeRequest, IntakeRequest,
  tagPolicies, InsertTagPolicy, TagPolicy,
  tierSyncLog, InsertTierSyncLog, TierSyncLog,
  QualityRule,
} from "../drizzle/schema";

// Alias para compatibilidade com adapters de qualidade
export type SelectQualityRule = QualityRule;

import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null as ReturnType<typeof drizzle> | null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
      _db = drizzle(pool) as any;
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod", "passwordHash"] as const;
  textFields.forEach((field) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  });
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  if (user.mustChangePassword !== undefined) {
    values.mustChangePassword = user.mustChangePassword;
    updateSet.mustChangePassword = user.mustChangePassword;
  }
  else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0] ?? null;
}

/**
 * JIT (Just-in-Time) provisioning para SSO (SAML / LDAP).
 * Cria um usuário local a partir de identidade externa se ainda não existir.
 */
export async function createUserViaSso(data: { email: string; name: string; orgId?: number }) {
  const dbConn = await getDb();
  if (!dbConn) return null;
  const { nanoid: nid } = await import("nanoid");
  const openId = `sso:${nid()}`;
  const newUser: InsertUser = {
    openId,
    email: data.email,
    name: data.name,
    loginMethod: "sso",
    role: "user",
    lastSignedIn: new Date(),
  };
  await dbConn.insert(users).values(newUser);
  const rows = await dbConn.select().from(users).where(eq(users.openId, openId)).limit(1);
  return rows[0] ?? null;
}

export async function createUser(data: Partial<InsertUser> & { email: string; name: string; passwordHash: string }) {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("DB not available");
  const { nanoid: nid } = await import("nanoid");
  const openId = `local:${nid()}`;
  const newUser: InsertUser = {
    openId,
    email: data.email,
    name: data.name,
    passwordHash: data.passwordHash,
    loginMethod: "local",
    role: (data.role as InsertUser["role"]) ?? "user",
    mustChangePassword: data.mustChangePassword ?? false,
    lastSignedIn: new Date(),
  };
  await dbConn.insert(users).values(newUser);
  const rows = await dbConn.select().from(users).where(eq(users.openId, openId)).limit(1);
  return rows[0] ?? null;
}

export async function countUsers(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ total: count() }).from(users);
  return rows[0]?.total ?? 0;
}

// ─── Domains ──────────────────────────────────────────────────────────────────
export async function getDomains() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(domains).orderBy(domains.name);
}

export async function getDomainById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
  return result[0];
}

export async function createDomain(data: InsertDomain) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(domains).values(data);
  return result;
}

export async function updateDomain(id: number, data: Partial<InsertDomain>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(domains).set(data).where(eq(domains.id, id));
}

export async function deleteDomain(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(domains).where(eq(domains.id, id));
}

// ─── Participants ─────────────────────────────────────────────────────────────
export async function getParticipants(domainId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (domainId) {
    return db.select().from(participants).where(eq(participants.domainId, domainId)).orderBy(participants.name);
  }
  return db.select().from(participants).orderBy(participants.name);
}

export async function getParticipantById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(participants).where(eq(participants.id, id)).limit(1);
  return result[0];
}

export async function createParticipant(data: InsertParticipant) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(participants).values(data);
}

export async function updateParticipant(id: number, data: Partial<InsertParticipant>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(participants).set(data).where(eq(participants.id, id));
}

export async function deleteParticipant(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(participants).where(eq(participants.id, id));
}

// ─── Meetings ─────────────────────────────────────────────────────────────────
export async function getMeetings(domainId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (domainId) {
    return db.select().from(meetings).where(eq(meetings.domainId, domainId)).orderBy(desc(meetings.scheduledAt));
  }
  return db.select().from(meetings).orderBy(desc(meetings.scheduledAt));
}

export async function getMeetingById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(meetings).where(eq(meetings.id, id)).limit(1);
  return result[0];
}

export async function createMeeting(data: InsertMeeting) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(meetings).values(data);
}

export async function updateMeeting(id: number, data: Partial<InsertMeeting>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(meetings).set(data).where(eq(meetings.id, id));
}

export async function deleteMeeting(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(meetings).where(eq(meetings.id, id));
}

// ─── Agenda Items ─────────────────────────────────────────────────────────────
export async function getAgendaItems(meetingId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agendaItems).where(eq(agendaItems.meetingId, meetingId)).orderBy(agendaItems.order);
}

export async function createAgendaItem(data: InsertAgendaItem) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(agendaItems).values(data);
}

export async function updateAgendaItem(id: number, data: Partial<InsertAgendaItem>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(agendaItems).set(data).where(eq(agendaItems.id, id));
}

export async function deleteAgendaItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(agendaItems).where(eq(agendaItems.id, id));
}

// ─── Invites ──────────────────────────────────────────────────────────────────
export interface InviteWithParticipant {
  id: number;
  meetingId: number;
  participantId: number;
  token: string;
  status: string | null;
  sentAt: Date | null;
  respondedAt: Date | null;
  responseNote: string | null;
  createdAt: Date;
  email: string | null;
  participantName: string | null;
}

export async function getInvitesByMeeting(meetingId: number): Promise<InviteWithParticipant[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: invites.id,
      meetingId: invites.meetingId,
      participantId: invites.participantId,
      token: invites.token,
      status: invites.status,
      sentAt: invites.sentAt,
      respondedAt: invites.respondedAt,
      responseNote: invites.responseNote,
      createdAt: invites.createdAt,
      email: participants.email,
      participantName: participants.name,
    })
    .from(invites)
    .leftJoin(participants, eq(invites.participantId, participants.id))
    .where(eq(invites.meetingId, meetingId));
}

export async function getInviteByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(invites).where(eq(invites.token, token)).limit(1);
  return result[0];
}

export async function createInvite(data: InsertInvite) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(invites).values(data);
}

export async function updateInvite(id: number, data: Partial<InsertInvite>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(invites).set(data).where(eq(invites.id, id));
}

export async function updateInviteByToken(token: string, data: Partial<InsertInvite>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(invites).set(data).where(eq(invites.token, token));
}

// ─── RACI Matrix ──────────────────────────────────────────────────────────────
export async function getRaciMatrix(domainId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (domainId) {
    return db.select().from(raciMatrix).where(eq(raciMatrix.domainId, domainId)).orderBy(raciMatrix.category, raciMatrix.activity);
  }
  return db.select().from(raciMatrix).orderBy(raciMatrix.category, raciMatrix.activity);
}

export async function createRaciItem(data: InsertRaciMatrix) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(raciMatrix).values(data);
}

export async function updateRaciItem(id: number, data: Partial<InsertRaciMatrix>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(raciMatrix).set(data).where(eq(raciMatrix.id, id));
}

export async function deleteRaciItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(raciMatrix).where(eq(raciMatrix.id, id));
}

// ─── Implementation Checklist ─────────────────────────────────────────────────
export async function getChecklist(domainId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(implementationChecklist)
    .where(eq(implementationChecklist.domainId, domainId))
    .orderBy(implementationChecklist.phase, implementationChecklist.order);
}

export async function createChecklistItem(data: InsertImplementationChecklist) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(implementationChecklist).values(data);
}

export async function updateChecklistItem(id: number, data: Partial<InsertImplementationChecklist>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(implementationChecklist).set(data).where(eq(implementationChecklist.id, id));
}

// ─── AI Chat History ──────────────────────────────────────────────────────────
export async function getAiChatHistory(sessionId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(aiChatHistory)
    .where(eq(aiChatHistory.sessionId, sessionId))
    .orderBy(aiChatHistory.createdAt);
}

export async function saveAiMessage(data: InsertAiChatHistory) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(aiChatHistory).values(data);
}

// ─── ServiceNow Tickets ───────────────────────────────────────────────────────
export async function getServicenowTickets(domainId?: number) {
  const db = await getDb();
  if (!db) return [];
  const base = db
    .select({
      id: servicenowTickets.id,
      ticketNumber: servicenowTickets.ticketNumber,
      title: servicenowTickets.title,
      description: servicenowTickets.description,
      status: servicenowTickets.status,
      priority: servicenowTickets.priority,
      assignedTo: servicenowTickets.assignedTo,
      domainId: servicenowTickets.domainId,
      participantId: servicenowTickets.participantId,
      meetingId: servicenowTickets.meetingId,
      meetingTitle: meetings.title,
      externalUrl: servicenowTickets.externalUrl,
      syncedAt: servicenowTickets.syncedAt,
      createdAt: servicenowTickets.createdAt,
      updatedAt: servicenowTickets.updatedAt,
    })
    .from(servicenowTickets)
    .leftJoin(meetings, eq(servicenowTickets.meetingId, meetings.id))
    .orderBy(desc(servicenowTickets.createdAt));
  if (domainId) {
    return base.where(eq(servicenowTickets.domainId, domainId));
  }
  return base;
}

export async function createServicenowTicket(data: InsertServicenowTicket) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(servicenowTickets).values(data);
}

export async function updateServicenowTicket(id: number, data: Partial<InsertServicenowTicket>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(servicenowTickets).set(data).where(eq(servicenowTickets.id, id));
}

// ─── Email Notifications ────────────────────────────────────────────────
export async function createEmailNotification(data: InsertEmailNotification) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(emailNotifications).values(data);
}

export async function updateEmailNotificationStatus(
  id: number,
  status: 'pendente' | 'enviado' | 'falhou' | 'cancelado',
  opts?: { sentAt?: Date; errorMessage?: string; retryCount?: number }
) {
  const db = await getDb();
  if (!db) return;
  return db.update(emailNotifications).set({
    status,
    sentAt: opts?.sentAt,
    errorMessage: opts?.errorMessage,
    retryCount: opts?.retryCount,
    updatedAt: new Date(),
  }).where(eq(emailNotifications.id, id));
}

export async function getEmailNotifications(opts: { limit?: number; offset?: number; status?: string }) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(emailNotifications).orderBy(desc(emailNotifications.createdAt)).limit(opts.limit ?? 50).offset(opts.offset ?? 0);
}

// ─── Notification Preferences ───────────────────────────────────────────
export async function getNotificationPreferences(participantId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(notificationPreferences)
    .where(eq(notificationPreferences.participantId, participantId)).limit(1);
  return result[0] ?? null;
}

export async function upsertNotificationPreferences(data: InsertNotificationPreference) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(notificationPreferences).values(data).onConflictDoUpdate({
    target: notificationPreferences.participantId,
    set: {
      meetingInvite: data.meetingInvite,
      meetingReminder: data.meetingReminder,
      meetingCancelled: data.meetingCancelled,
      decisionRegistered: data.decisionRegistered,
      meetingSummary: data.meetingSummary,
      domainUpdate: data.domainUpdate,
      reminderHoursBefore: data.reminderHoursBefore,
      updatedAt: new Date(),
    },
  });
}

// ─── Metrics / Dashboard ──────────────────────────────────────────────────────
export async function getDashboardMetrics() {
  const db = await getDb();
  if (!db) return null;

  const [totalParticipants] = await db.select({ count: count() }).from(participants);
  const [activeParticipants] = await db.select({ count: count() }).from(participants).where(eq(participants.status, 'ativo'));
  const [totalDomains] = await db.select({ count: count() }).from(domains);
  const [totalMeetings] = await db.select({ count: count() }).from(meetings);
  const [upcomingMeetings] = await db.select({ count: count() }).from(meetings).where(eq(meetings.status, 'agendada'));
  const [totalInvites] = await db.select({ count: count() }).from(invites);
  const [confirmedInvites] = await db.select({ count: count() }).from(invites).where(eq(invites.status, 'confirmado'));
  const [pendingInvites] = await db.select({ count: count() }).from(invites).where(eq(invites.status, 'pendente'));
  const [openTickets] = await db.select({ count: count() }).from(servicenowTickets);

  const roleDistribution = await db.select({
    role: participants.role,
    count: count(),
  }).from(participants).groupBy(participants.role);

  const domainProgress = await db.select({
    id: domains.id,
    name: domains.name,
    progress: domains.implementationProgress,
    status: domains.status,
  }).from(domains);

  return {
    totalParticipants: totalParticipants?.count ?? 0,
    activeParticipants: activeParticipants?.count ?? 0,
    totalDomains: totalDomains?.count ?? 0,
    totalMeetings: totalMeetings?.count ?? 0,
    upcomingMeetings: upcomingMeetings?.count ?? 0,
    totalInvites: totalInvites?.count ?? 0,
    confirmedInvites: confirmedInvites?.count ?? 0,
    pendingInvites: pendingInvites?.count ?? 0,
    openTickets: openTickets?.count ?? 0,
    roleDistribution,
    domainProgress,
    assetCriticality: await db.select({
      criticality: dataAssets.criticality,
      count: count(),
    }).from(dataAssets).groupBy(dataAssets.criticality),
  };
}

// ─── Export History ────────────────────────────────────────────────────────────
export async function createExportHistory(data: InsertExportHistory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [inserted] = await db.insert(exportHistory).values(data).returning();
  return inserted;
}

export async function getExportHistory(opts?: {
  limit?: number;
  offset?: number;
  documentType?: string;
  generatedBy?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(exportHistory).$dynamic();
  const conditions = [];
  if (opts?.documentType) conditions.push(eq(exportHistory.documentType, opts.documentType as "meeting_minutes_pdf" | "meeting_minutes_docx" | "organogram_pdf" | "metrics_report_pdf"));
  if (opts?.generatedBy) conditions.push(eq(exportHistory.generatedBy, opts.generatedBy));
  if (conditions.length > 0) query = query.where(and(...conditions));
  query = query.orderBy(desc(exportHistory.createdAt));
  if (opts?.limit) query = query.limit(opts.limit);
  if (opts?.offset) query = query.offset(opts.offset);
  return query;
}

export async function getExportHistoryById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(exportHistory).where(eq(exportHistory.id, id));
  return rows[0] ?? null;
}

export async function deleteExportHistory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(exportHistory).where(eq(exportHistory.id, id));
  return { success: true };
}

export async function countExportHistory(opts?: {
  documentType?: string;
  generatedBy?: string;
}) {
  const db = await getDb();
  if (!db) return 0;
  const conditions = [];
  if (opts?.documentType) conditions.push(eq(exportHistory.documentType, opts.documentType as "meeting_minutes_pdf" | "meeting_minutes_docx" | "organogram_pdf" | "metrics_report_pdf"));
  if (opts?.generatedBy) conditions.push(eq(exportHistory.generatedBy, opts.generatedBy));
  const [result] = conditions.length > 0
    ? await db.select({ count: count() }).from(exportHistory).where(and(...conditions))
    : await db.select({ count: count() }).from(exportHistory);
  return result?.count ?? 0;
}

export async function getAllExportHistory(opts?: {
  documentType?: string;
  generatedBy?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(exportHistory).$dynamic();
  const conditions = [];
  if (opts?.documentType) conditions.push(eq(exportHistory.documentType, opts.documentType as "meeting_minutes_pdf" | "meeting_minutes_docx" | "organogram_pdf" | "metrics_report_pdf"));
  if (opts?.generatedBy) conditions.push(eq(exportHistory.generatedBy, opts.generatedBy));
  if (conditions.length > 0) query = query.where(and(...conditions));
  return query.orderBy(desc(exportHistory.createdAt));
}

// ─── Role Management ──────────────────────────────────────────────────────────
export async function getUnifiedMembers(opts?: {
  search?: string;
  role?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  
  // Query unificada: Participantes + Usuários do Sistema
  let query = db.select({
    participantId: participants.id,
    name: participants.name,
    email: participants.email,
    jobTitle: participants.jobTitle,
    department: participants.department,
    participantRole: participants.role, // Papel no Comitê
    userId: users.id,
    openId: users.openId,
    systemRole: users.role, // Papel no Sistema
    lastSignedIn: users.lastSignedIn,
    status: participants.status
  })
  .from(participants)
  .leftJoin(users, eq(participants.userId, users.id))
  .$dynamic();

  const conditions = [];
  if (opts?.role) conditions.push(eq(users.role, opts.role as any));
  if (opts?.search) {
    const like = `%${opts.search}%`;
    conditions.push(sql`(${participants.name} LIKE ${like} OR participants.email LIKE ${like})`);
  }
  
  if (conditions.length > 0) query = query.where(and(...conditions));
  
  return query.orderBy(participants.name);
}

export async function getAllUsers(opts?: {
  search?: string;
  role?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select({
    id: users.id,
    openId: users.openId,
    name: users.name,
    email: users.email,
    role: users.role,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users).$dynamic();
  const conditions = [];
  if (opts?.role) conditions.push(eq(users.role, opts.role as any));
  if (opts?.search) {
    const like = `%${opts.search}%`;
    conditions.push(sql`(${users.name} LIKE ${like} OR ${users.email} LIKE ${like})`);
  }
  if (conditions.length > 0) query = query.where(and(...conditions));
  return query.orderBy(users.name);
}

export async function updateUserRole(openId: string, role: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ role: role as any, updatedAt: new Date() }).where(eq(users.openId, openId));
  return getUserByOpenId(openId);
}

export async function deleteUser(openId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(users).where(eq(users.openId, openId));
}

export async function countAdmins() {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.select({ count: count() }).from(users).where(eq(users.role, "admin"));
  return result?.count ?? 0;
}

// ─── Role Audit Log ───────────────────────────────────────────────────────────
import { roleAuditLog, InsertRoleAuditLog } from "../drizzle/schema";

export async function createRoleAuditLog(data: InsertRoleAuditLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(roleAuditLog).values(data);
}

export async function getRoleAuditLog(opts?: {
  limit?: number;
  offset?: number;
  action?: "promoted" | "demoted";
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
}) {
  const db = await getDb();
  if (!db) return [];
  const limit = opts?.limit ?? 20;
  const offset = opts?.offset ?? 0;
  let query = db.select().from(roleAuditLog).$dynamic();
  const conditions = [];
  if (opts?.action === "promoted") {
    conditions.push(sql`${roleAuditLog.newRole} != 'user'`);
  } else if (opts?.action === "demoted") {
    conditions.push(sql`${roleAuditLog.newRole} = 'user'`);
  }
  if (opts?.search) {
    const like = `%${opts.search}%`;
    conditions.push(
      sql`(${roleAuditLog.executorName} LIKE ${like} OR ${roleAuditLog.targetName} LIKE ${like} OR ${roleAuditLog.targetEmail} LIKE ${like})`
    );
  }
  if (opts?.dateFrom) {
    conditions.push(sql`${roleAuditLog.createdAt} >= ${opts.dateFrom}`);
  }
  if (opts?.dateTo) {
    // Inclui o dia inteiro do dateTo (até 23:59:59)
    const endOfDay = new Date(opts.dateTo);
    endOfDay.setHours(23, 59, 59, 999);
    conditions.push(sql`${roleAuditLog.createdAt} <= ${endOfDay}`);
  }
  if (conditions.length > 0) query = query.where(and(...conditions));
  return query.orderBy(desc(roleAuditLog.createdAt)).limit(limit).offset(offset);
}

export async function countRoleAuditLog(opts?: {
  action?: "promoted" | "demoted";
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
}) {
  const db = await getDb();
  if (!db) return 0;
  let query = db.select({ count: count() }).from(roleAuditLog).$dynamic();
  const conditions = [];
  if (opts?.action === "promoted") {
    conditions.push(sql`${roleAuditLog.newRole} != 'user'`);
  } else if (opts?.action === "demoted") {
    conditions.push(sql`${roleAuditLog.newRole} = 'user'`);
  }
  if (opts?.search) {
    const like = `%${opts.search}%`;
    conditions.push(
      sql`(${roleAuditLog.executorName} LIKE ${like} OR ${roleAuditLog.targetName} LIKE ${like} OR ${roleAuditLog.targetEmail} LIKE ${like})`
    );
  }
  if (opts?.dateFrom) {
    conditions.push(sql`${roleAuditLog.createdAt} >= ${opts.dateFrom}`);
  }
  if (opts?.dateTo) {
    const endOfDay = new Date(opts.dateTo);
    endOfDay.setHours(23, 59, 59, 999);
    conditions.push(sql`${roleAuditLog.createdAt} <= ${endOfDay}`);
  }
  if (conditions.length > 0) query = query.where(and(...conditions));
  const [result] = await query;
  return result?.count ?? 0;
}

// ─── Validation Helpers ───────────────────────────────────────────────────────

/** Returns conflict info if there is an overlapping meeting in the given time window.
 *  Overlap: newStart < existingEnd AND newEnd > existingStart.
 *  Pass excludeId to ignore a specific meeting (useful for edit scenarios). */
export async function checkMeetingConflict(
  scheduledAt: Date,
  endAt: Date | null,
  excludeId?: number
): Promise<{ hasConflict: boolean; conflictTitle?: string; conflictTime?: string }> {
  const db = await getDb();
  if (!db) return { hasConflict: false };

  const existing = await db
    .select({ id: meetings.id, title: meetings.title, scheduledAt: meetings.scheduledAt, endAt: meetings.endAt })
    .from(meetings)
    .where(sql`${meetings.status} != 'cancelada'`);

  const newStart = scheduledAt.getTime();
  const newEnd = endAt ? endAt.getTime() : newStart + 60 * 60 * 1000; // assume 1h if no endAt

  for (const m of existing) {
    if (excludeId && m.id === excludeId) continue;
    const mStart = new Date(m.scheduledAt).getTime();
    const mEnd = m.endAt ? new Date(m.endAt).getTime() : mStart + 60 * 60 * 1000;
    if (newStart < mEnd && newEnd > mStart) {
      const fmt = new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
      return { hasConflict: true, conflictTitle: m.title, conflictTime: fmt.format(new Date(m.scheduledAt)) };
    }
  }
  return { hasConflict: false };
}

/** Returns true if a domain with the given name already exists (case-insensitive).
 *  Pass excludeId to ignore a specific domain (useful for edit scenarios). */
export async function checkDomainNameExists(name: string, excludeId?: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select({ id: domains.id })
    .from(domains)
    .where(sql`LOWER(${domains.name}) = LOWER(${name})`);
  return rows.some((r) => r.id !== excludeId);
}

/** Returns true if a participant with the given email already exists (case-insensitive).
 *  Pass excludeId to ignore a specific participant (useful for edit scenarios). */
export async function checkParticipantEmailExists(email: string, excludeId?: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select({ id: participants.id })
    .from(participants)
    .where(sql`LOWER(${participants.email}) = LOWER(${email})`);
  return rows.some((r) => r.id !== excludeId);
}

/** Returns monthly meeting counts for the last N months, broken down by status.
 *  Each entry: { month: "2025-04", realizada: 3, agendada: 1, cancelada: 0, adiada: 0, total: 4 } */
export async function getMeetingsByMonth(months: number = 6): Promise<Array<{
  month: string;
  realizada: number;
  agendada: number;
  cancelada: number;
  adiada: number;
  total: number;
}>> {
  const db = await getDb();
  if (!db) return [];

  // Build the last N months as YYYY-MM strings (descending, then reverse for chart)
  const result: Array<{ month: string; realizada: number; agendada: number; cancelada: number; adiada: number; total: number }> = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const monthKey = `${year}-${month}`;

    const rows = await db
      .select({ status: meetings.status, cnt: count() })
      .from(meetings)
      .where(sql`TO_CHAR(${meetings.scheduledAt}, 'YYYY-MM') = ${monthKey}`)
      .groupBy(meetings.status);

    const counts = { realizada: 0, agendada: 0, cancelada: 0, adiada: 0 };
    for (const row of rows) {
      if (row.status && row.status in counts) {
        counts[row.status as keyof typeof counts] = Number(row.cnt);
      }
    }
    result.push({ month: monthKey, ...counts, total: Object.values(counts).reduce((a, b) => a + b, 0) });
  }
  return result;
}

// ─── Meeting Attendance (Teams) ──────────────────────────────────────────────

export async function getAttendanceByMeeting(meetingId: number): Promise<MeetingAttendance[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(meetingAttendance)
    .where(eq(meetingAttendance.meetingId, meetingId))
    .orderBy(meetingAttendance.joinedAt);
}

export async function upsertAttendanceRecord(
  record: InsertMeetingAttendance
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = record.participantEmail
    ? await db.select({ id: meetingAttendance.id })
        .from(meetingAttendance)
        .where(
          and(
            eq(meetingAttendance.meetingId, record.meetingId),
            eq(meetingAttendance.participantEmail, record.participantEmail)
          )
        )
        .limit(1)
    : [];
  if (existing.length > 0) {
    await db.update(meetingAttendance)
      .set({ ...record, updatedAt: new Date() })
      .where(eq(meetingAttendance.id, existing[0].id));
  } else {
    await db.insert(meetingAttendance).values(record);
  }
}

export async function deleteAttendanceByMeeting(meetingId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(meetingAttendance).where(eq(meetingAttendance.meetingId, meetingId));
}

export async function updateMeetingTeamsInfo(
  meetingId: number,
  info: { teamsMeetingId?: string; teamsJoinUrl?: string; teamsAttendanceSyncedAt?: Date }
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(meetings).set({ ...info, updatedAt: new Date() }).where(eq(meetings.id, meetingId));
}

export async function getAttendanceRateByPeriod(months: number): Promise<
  Array<{ meetingId: number; title: string; scheduledAt: Date; totalInvited: number; totalAttended: number; attendanceRate: number }>
> {
  const db = await getDb();
  if (!db) return [];
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const recentMeetings = await db.select({
    id: meetings.id,
    title: meetings.title,
    scheduledAt: meetings.scheduledAt,
  })
    .from(meetings)
    .where(and(eq(meetings.status, 'realizada'), sql`${meetings.scheduledAt} >= ${since}`))
    .orderBy(meetings.scheduledAt);

  const result = [];
  for (const m of recentMeetings) {
    const [inviteCount] = await db.select({ cnt: count() }).from(invites).where(eq(invites.meetingId, m.id));
    const [attendedCount] = await db.select({ cnt: count() }).from(meetingAttendance)
      .where(and(eq(meetingAttendance.meetingId, m.id), eq(meetingAttendance.attended, true)));
    const totalInvited = Number(inviteCount?.cnt ?? 0);
    const totalAttended = Number(attendedCount?.cnt ?? 0);
    result.push({
      meetingId: m.id,
      title: m.title,
      scheduledAt: m.scheduledAt,
      totalInvited,
      totalAttended,
      attendanceRate: totalInvited > 0 ? Math.round((totalAttended / totalInvited) * 100) : 0,
    });
  }
  return result;
}

// ─── Scheduler helpers ────────────────────────────────────────────────────────

/**
 * Retorna reuniões elegíveis para sincronização automática de presença:
 *   - vinculadas ao Teams (teamsMeetingId preenchido)
 *   - status = 'realizada'
 *   - endAt <= cutoff (encerradas há pelo menos N minutos)
 *   - teamsAttendanceSyncedAt IS NULL (ainda não sincronizadas)
 */
export async function getMeetingsPendingAttendanceSync(
  cutoff: Date
): Promise<Array<{ id: number; title: string; teamsMeetingId: string }>> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      teamsMeetingId: meetings.teamsMeetingId,
    })
    .from(meetings)
    .where(
      and(
        eq(meetings.status, "realizada"),
        isNotNull(meetings.teamsMeetingId),
        isNull(meetings.teamsAttendanceSyncedAt),
        sql`${meetings.endAt} <= ${cutoff}`
      )
    );

  return rows.filter((r) => r.teamsMeetingId != null) as Array<{
    id: number;
    title: string;
    teamsMeetingId: string;
  }>;
}

// ─── Stale High-Priority Tickets ─────────────────────────────────────────────
/**
 * Retorna tickets de prioridade alta ou crítica que estão em aberto (novo ou
 * em_andamento) e não foram atualizados nos últimos `staleDays` dias.
 * Faz LEFT JOIN com participants para obter o e-mail do responsável.
 */
export async function getStaleHighPriorityTickets(staleDays = 7): Promise<
  Array<{
    id: number;
    ticketNumber: string;
    title: string;
    status: string | null;
    priority: string | null;
    assignedTo: string | null;
    participantId: number | null;
    participantName: string | null;
    participantEmail: string | null;
    domainId: number | null;
    updatedAt: Date | null;
    daysSinceUpdate: number;
  }>
> {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      id: servicenowTickets.id,
      ticketNumber: servicenowTickets.ticketNumber,
      title: servicenowTickets.title,
      status: servicenowTickets.status,
      priority: servicenowTickets.priority,
      assignedTo: servicenowTickets.assignedTo,
      participantId: servicenowTickets.participantId,
      participantName: participants.name,
      participantEmail: participants.email,
      domainId: servicenowTickets.domainId,
      updatedAt: servicenowTickets.updatedAt,
    })
    .from(servicenowTickets)
    .leftJoin(participants, eq(servicenowTickets.participantId, participants.id))
    .where(
      and(
        sql`${servicenowTickets.priority} IN ('alta', 'critica')`,
        sql`${servicenowTickets.status} IN ('novo', 'em_andamento')`,
        sql`${servicenowTickets.updatedAt} <= ${cutoff}`
      )
    )
    .orderBy(desc(servicenowTickets.priority), servicenowTickets.updatedAt);
  return rows.map((r) => ({
    ...r,
    daysSinceUpdate: r.updatedAt
      ? Math.floor((Date.now() - new Date(r.updatedAt).getTime()) / (24 * 60 * 60 * 1000))
      : staleDays,
  }));
}

// ─── Ticket Alert Configs ─────────────────────────────────────────────────────
export async function getTicketAlertConfigs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(ticketAlertConfigs).orderBy(ticketAlertConfigs.domainId);
}

export async function getTicketAlertConfigByDomain(domainId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(ticketAlertConfigs).where(eq(ticketAlertConfigs.domainId, domainId)).limit(1);
  return rows[0];
}

export async function upsertTicketAlertConfig(data: InsertTicketAlertConfig) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db
    .insert(ticketAlertConfigs)
    .values(data)
    .onConflictDoUpdate({
      target: ticketAlertConfigs.domainId,
      set: {
        criticalDays: data.criticalDays,
        highDays: data.highDays,
        enabled: data.enabled,
      },
    });
}

// ─── Ticket Alert — busca todos os tickets elegíveis sem filtro de data ───────
/** Retorna todos os tickets de alta/crítica prioridade em aberto, com a data
 *  de última atualização, para que o scheduler aplique o limiar por domínio. */
export async function getAllOpenHighPriorityTickets(): Promise<
  Array<{
    id: number;
    ticketNumber: string;
    title: string;
    status: string | null;
    priority: string | null;
    assignedTo: string | null;
    participantId: number | null;
    participantName: string | null;
    participantEmail: string | null;
    domainId: number | null;
    updatedAt: Date | null;
  }>
> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: servicenowTickets.id,
      ticketNumber: servicenowTickets.ticketNumber,
      title: servicenowTickets.title,
      status: servicenowTickets.status,
      priority: servicenowTickets.priority,
      assignedTo: servicenowTickets.assignedTo,
      participantId: servicenowTickets.participantId,
      participantName: participants.name,
      participantEmail: participants.email,
      domainId: servicenowTickets.domainId,
      updatedAt: servicenowTickets.updatedAt,
    })
    .from(servicenowTickets)
    .leftJoin(participants, eq(servicenowTickets.participantId, participants.id))
    .where(
      and(
        sql`${servicenowTickets.priority} IN ('alta', 'critica')`,
        sql`${servicenowTickets.status} IN ('novo', 'em_andamento')`
      )
    )
    .orderBy(desc(servicenowTickets.priority), servicenowTickets.updatedAt);
}

// ─── System Settings ──────────────────────────────────────────────────────────
import { systemSettings } from "../drizzle/schema";

export async function getSystemSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
  return result[0]?.value ?? null;
}

export async function getSystemSettings(): Promise<Array<{ key: string; value: string | null; description: string | null }>> {
  const db = await getDb();
  if (!db) return [];
  return db.select({ key: systemSettings.key, value: systemSettings.value, description: systemSettings.description }).from(systemSettings);
}

export async function setSystemSetting(key: string, value: string | null, description?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(systemSettings).values({ key, value, description }).onConflictDoUpdate({
    target: systemSettings.key,
    set: { value, description: description ?? undefined },
  });
}

// ─── Feedbacks ───────────────────────────────────────────────────────────────
export async function createFeedback(data: InsertFeedback) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(feedbacks).values(data);
}

export async function getFeedbacks(opts?: { limit?: number; offset?: number; status?: string; type?: string; userId?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select({
    id: feedbacks.id,
    userId: feedbacks.userId,
    userName: users.name,
    userEmail: users.email,
    type: feedbacks.type,
    message: feedbacks.message,
    status: feedbacks.status,
    createdAt: feedbacks.createdAt,
    updatedAt: feedbacks.updatedAt,
  })
  .from(feedbacks)
  .leftJoin(users, eq(feedbacks.userId, users.id))
  .$dynamic();

  const conditions = [];
  if (opts?.status) conditions.push(eq(feedbacks.status, opts.status as any));
  if (opts?.type) conditions.push(eq(feedbacks.type, opts.type as any));
  if (opts?.userId) conditions.push(eq(feedbacks.userId, opts.userId));
  
  if (conditions.length > 0) query = query.where(and(...conditions));
  
  query = query.orderBy(desc(feedbacks.createdAt));
  
  if (opts?.limit) query = query.limit(opts.limit);
  if (opts?.offset) query = query.offset(opts.offset);
  
  return query;
}

export async function updateFeedbackStatus(id: number, status: "novo" | "em_analise" | "concluido") {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(feedbacks).set({ status, updatedAt: new Date() }).where(eq(feedbacks.id, id));
}

// ─── Data Assets ─────────────────────────────────────────────────────────────

// ── Busca Semântica: Mapa de sinônimos ───────────────────────────────────────
const SEARCH_SYNONYMS: Record<string, string[]> = {
  cliente:      ["customer", "kna1", "client", "clientes"],
  clientes:     ["customer", "kna1", "client", "cliente"],
  fornecedor:   ["vendor", "lfa1", "supplier", "fornecedores"],
  produto:      ["material", "mara", "product", "item", "produtos"],
  venda:        ["sale", "billing", "invoice", "fatura", "vendas", "vbak", "vbap"],
  pedido:       ["order", "vbak", "purchase", "requisicao"],
  financeiro:   ["finance", "fi", "gl", "ledger", "contabil", "conta"],
  rh:           ["hr", "funcionario", "employee", "pa0001", "pessoal"],
  funcionario:  ["employee", "hr", "pa0001", "rh", "colaborador"],
  estoque:      ["stock", "inventory", "mard", "mseg", "almoxarifado"],
  nota:         ["nfe", "invoice", "nf", "fiscal", "nota_fiscal"],
  contrato:     ["contract", "agreements"],
  pagamento:    ["payment", "ap", "contas_pagar"],
  receita:      ["revenue", "receitas", "faturamento", "billing"],
  pii:          ["cpf", "cnpj", "pessoal", "sensivel", "lgpd", "privacidade"],
  lgpd:         ["pii", "pessoal", "sensivel", "privacidade"],
  sensivel:     ["restrito", "confidencial", "pii", "lgpd"],
  kna1:         ["cliente", "customer", "master"],
  mara:         ["material", "produto", "product"],
  qualidade:    ["quality", "score", "threshold", "check"],
  lineagem:     ["lineage", "origem", "dependencia", "fluxo"],
  catalogo:     ["catalog", "ativos", "assets", "inventario"],
  databricks:   ["delta", "lakehouse", "spark", "bronze", "silver", "gold"],
  kafka:        ["topic", "stream", "evento", "mensagem", "fila"],
  tableau:      ["dashboard", "workbook", "viz", "relatorio"],
  redshift:     ["dw", "data_warehouse", "fato", "dimensao", "star_schema"],
  relatorio:    ["report", "dashboard", "bi", "analytics", "tableau"],
  mestre:       ["master_data", "mdm", "dimensao", "dim", "referencia"],
  transacional: ["fato", "fact", "oltp", "operacional", "transacao"],
};

/**
 * Calcula score TF-IDF simplificado para re-ranquear resultados de busca.
 * TF = frequência do termo no documento normalizada pelo comprimento.
 * IDF = log(N / df+1) onde df é aproximado como 1 (sem corpus completo).
 * Bônus: match exato no nome recebe peso extra.
 */
function tfidfScore(doc: { name: string; description?: string | null; sourceSystem?: string | null; businessArea?: string | null }, terms: string[]): number {
  const fields = [
    { text: (doc.name ?? "").toLowerCase(), weight: 3 },
    { text: (doc.description ?? "").toLowerCase(), weight: 1 },
    { text: (doc.sourceSystem ?? "").toLowerCase(), weight: 2 },
    { text: (doc.businessArea ?? "").toLowerCase(), weight: 1.5 },
  ];

  let score = 0;
  for (const term of terms) {
    for (const field of fields) {
      if (!field.text) continue;
      // TF: contagem de ocorrências / comprimento do campo em palavras
      const words = field.text.split(/\s+/);
      const tf = words.filter(w => w.includes(term) || term.includes(w)).length / Math.max(words.length, 1);
      // IDF simplificado: log(100) ≈ 4.6 como constante (sem corpus real)
      const idf = Math.log(100 / 2);
      score += tf * idf * field.weight;
    }
    // Bônus: nome começa exatamente com o termo
    if (doc.name.toLowerCase().startsWith(term)) score += 5;
    // Bônus: match exato no nome
    if (doc.name.toLowerCase() === term) score += 10;
  }
  return score;
}

/**
 * Enriquece os ativos com scores de valor de negócio calculados dinamicamente
 * caso eles não possuam uma sobrescrita manual (> 0).
 */
export async function enrichAssetsWithScores<T extends { id: number, ownerId: number | null, stewardId: number | null, businessValueScore: number | null }>(assets: T[]): Promise<T[]> {
  if (assets.length === 0) return assets;
  const db = await getDb();
  if (!db) return assets;

  // Busca todas as arestas da linhagem para calcular o impacto (centralidade)
  const lineage = await db.select().from(dataLineage).catch(() => []);
  
  // Constrói lista de adjacência downstream (sourceAssetId -> targetAssetId)
  const adj = new Map<number, number[]>();
  for (const edge of lineage) {
    if (!adj.has(edge.sourceAssetId)) {
      adj.set(edge.sourceAssetId, []);
    }
    adj.get(edge.sourceAssetId)!.push(edge.targetAssetId);
  }

  // Memoization de contagem de nós dependentes downstream
  const downstreamCounts = new Map<number, number>();
  
  function getDownstreamCount(startId: number): number {
    if (downstreamCounts.has(startId)) {
      return downstreamCounts.get(startId)!;
    }
    const visited = new Set<number>();
    const queue = [startId];
    visited.add(startId);
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const children = adj.get(curr) || [];
      for (const child of children) {
        if (!visited.has(child)) {
          visited.add(child);
          queue.push(child);
        }
      }
    }
    const count = visited.size - 1; // exclui o próprio nó inicial
    downstreamCounts.set(startId, count);
    return count;
  }

  return assets.map(asset => {
    const rawScore = asset.businessValueScore || 0;
    const downstreamCount = getDownstreamCount(asset.id);
    
    // Formula Híbrida:
    // Base: 30
    // Linhagem: +15 por dependente a jusante
    // Governança: +10 se tiver Owner, +10 se tiver Steward
    // Cap: 100
    const calculatedScore = Math.min(100, 30 + (downstreamCount * 15) + (asset.ownerId ? 10 : 0) + (asset.stewardId ? 10 : 0));
    
    return {
      ...asset,
      rawBusinessValueScore: rawScore,
      businessValueScore: rawScore > 0 ? rawScore : calculatedScore
    };
  });
}

/**
 * Busca semântica com TF-IDF re-ranking + expansão de sinônimos.
 * Executa LIKE query e re-ranqueia resultados por relevância.
 */
export async function semanticSearchAssets(search: string, opts?: {
  organizationId?: number;
  sensitivity?: string;
  type?: string;
  limit?: number;
}): Promise<Awaited<ReturnType<typeof getDataAssets>>> {
  // Busca candidatos via LIKE (amplo)
  const candidates = await searchDataAssets(search, { ...opts, limit: 200 });
  if (candidates.length === 0) return [];

  const terms = expandSearchTerms(search);
  // Score TF-IDF para cada candidato
  const scored = candidates.map(asset => ({
    asset,
    score: tfidfScore(asset as any, terms),
  }));

  // Ordena por score decrescente
  scored.sort((a, b) => b.score - a.score);

  const limit = opts?.limit ?? 50;
  return scored.slice(0, limit).map(s => s.asset);
}

function expandSearchTerms(input: string): string[] {
  const normalized = input.toLowerCase().trim();
  const words = normalized.split(/\s+/);
  const expanded = new Set<string>(words);
  for (const word of words) {
    const synonyms = SEARCH_SYNONYMS[word];
    if (synonyms) for (const syn of synonyms) expanded.add(syn);
  }
  return Array.from(expanded);
}

/**
 * Busca com fallback LIKE para quando FULLTEXT não retornar resultados.
 * Útil quando o índice FULLTEXT ainda não foi criado ou para termos muito curtos.
 */
export async function searchDataAssets(search: string, opts?: {
  organizationId?: number;
  sensitivity?: string;
  type?: string;
  limit?: number;
}): Promise<Awaited<ReturnType<typeof getDataAssets>>> {
  const database = await getDb();
  if (!database) return [];

  const ownerAlias = alias(participants, 'owner');
  const stewardAlias = alias(participants, 'steward');
  const terms = expandSearchTerms(search);

  // Condição OR de LIKE para cada termo expandido
  const likeConditions = terms.map(t => {
    const pat = `%${t}%`;
    return sql`(${dataAssets.name} LIKE ${pat} OR ${dataAssets.description} LIKE ${pat} OR ${dataAssets.sourceSystem} LIKE ${pat})`;
  });

  const baseConditions: any[] = [];
  if (opts?.organizationId) baseConditions.push(eq(dataAssets.organizationId, opts.organizationId));
  if (opts?.sensitivity)    baseConditions.push(eq(dataAssets.sensitivity, opts.sensitivity as any));
  if (opts?.type)           baseConditions.push(eq(dataAssets.type, opts.type as any));

  const likeOr = likeConditions.reduce((acc, cond) => sql`${acc} OR ${cond}`);
  const where = and(...baseConditions, sql`(${likeOr})`);

  let q = database
    .select({
      ...getTableColumns(dataAssets),
      domainName: domains.name,
      ownerName: ownerAlias.name,
      ownerEmail: ownerAlias.email,
      ownerRole: ownerAlias.role,
      ownerDepartment: ownerAlias.department,
      stewardName: stewardAlias.name,
      stewardEmail: stewardAlias.email,
      stewardRole: stewardAlias.role,
      stewardDepartment: stewardAlias.department,
    })
    .from(dataAssets)
    .leftJoin(domains, eq(dataAssets.domainId, domains.id))
    .leftJoin(ownerAlias, eq(dataAssets.ownerId, ownerAlias.id))
    .leftJoin(stewardAlias, eq(dataAssets.stewardId, stewardAlias.id))
    .where(where)
    .orderBy(dataAssets.name)
    .$dynamic();

  if (opts?.limit) q = q.limit(opts.limit);
  const result = await q;
  return enrichAssetsWithScores(result);
}

export async function getDataAssets(opts?: {
  domainId?: number;
  search?: string;
  sensitivity?: string;
  criticality?: string;
  type?: string;
  limit?: number;
  offset?: number;
  organizationId?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const ownerAlias = alias(participants, 'owner');
  const stewardAlias = alias(participants, 'steward');

  const conditions: ReturnType<typeof eq>[] = [];

  if (opts?.domainId) conditions.push(eq(dataAssets.domainId, opts.domainId));
  if (opts?.sensitivity) conditions.push(eq(dataAssets.sensitivity, opts.sensitivity as any));
  if (opts?.criticality) conditions.push(eq(dataAssets.criticality, opts.criticality as any));
  if (opts?.type) conditions.push(eq(dataAssets.type, opts.type as any));
  if (opts?.organizationId) conditions.push(eq(dataAssets.organizationId, opts.organizationId));

  if (opts?.search && opts.search.trim()) {
    const terms = expandSearchTerms(opts.search.trim());
    // FULLTEXT search com expansão semântica de sinônimos
    const ftTerm = terms.map(t => `+${t.replace(/[+\-><()"~*@]/g, "")}*`).join(" ");
    conditions.push(
      sql`(${dataAssets.name} ILIKE ${'%' + opts.search!.trim() + '%'} OR ${dataAssets.description} ILIKE ${'%' + opts.search!.trim() + '%'})` as any
    );
  }

  let q = db
    .select({
      ...getTableColumns(dataAssets),
      domainName: domains.name,
      ownerName: ownerAlias.name,
      ownerEmail: ownerAlias.email,
      ownerRole: ownerAlias.role,
      ownerDepartment: ownerAlias.department,
      stewardName: stewardAlias.name,
      stewardEmail: stewardAlias.email,
      stewardRole: stewardAlias.role,
      stewardDepartment: stewardAlias.department,
    })
    .from(dataAssets)
    .leftJoin(domains, eq(dataAssets.domainId, domains.id))
    .leftJoin(ownerAlias, eq(dataAssets.ownerId, ownerAlias.id))
    .leftJoin(stewardAlias, eq(dataAssets.stewardId, stewardAlias.id))
    .$dynamic();
  
  if (conditions.length > 0) q = q.where(and(...conditions));
  
  q = q.orderBy(dataAssets.name);

  if (opts?.limit !== undefined) {
    q = q.limit(opts.limit);
  }
  if (opts?.offset !== undefined) {
    q = q.offset(opts.offset);
  }

  const result = await q;
  return enrichAssetsWithScores(result);
}

export async function getDataAssetById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const ownerAlias = alias(participants, 'owner');
  const stewardAlias = alias(participants, 'steward');
  const result = await db
    .select({
      ...getTableColumns(dataAssets),
      domainName: domains.name,
      ownerName: ownerAlias.name,
      ownerEmail: ownerAlias.email,
      ownerRole: ownerAlias.role,
      ownerDepartment: ownerAlias.department,
      stewardName: stewardAlias.name,
      stewardEmail: stewardAlias.email,
      stewardRole: stewardAlias.role,
      stewardDepartment: stewardAlias.department,
    })
    .from(dataAssets)
    .leftJoin(domains, eq(dataAssets.domainId, domains.id))
    .leftJoin(ownerAlias, eq(dataAssets.ownerId, ownerAlias.id))
    .leftJoin(stewardAlias, eq(dataAssets.stewardId, stewardAlias.id))
    .where(eq(dataAssets.id, id))
    .limit(1);
  if (!result[0]) return undefined;
  const enriched = await enrichAssetsWithScores([result[0]]);
  return enriched[0];
}

export async function createDataAsset(data: InsertDataAsset) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [inserted] = await db.insert(dataAssets).values(data).returning();
  return inserted;
}

export async function updateDataAsset(id: number, data: Partial<InsertDataAsset>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  
  // Se estiver atualizando o score, salva no histórico para tendências
  if (data.qualityScore !== undefined) {
    const asset = await getDataAssetById(id);
    if (asset) {
      await db.insert(dataQualityHistory).values({
        assetId: id,
        avgScore: data.qualityScore as any,
        organizationId: asset.organizationId ?? 1,
        measuredAt: new Date(),
      }).catch(err => console.error("[QualityHistory] Erro ao salvar histórico:", err));
    }
  }

  return db.update(dataAssets).set(data).where(eq(dataAssets.id, id));
}

/** Retorna o histórico de qualidade de um ativo para gráficos de tendência */
export async function getDataQualityHistory(assetId: number, days = 30) {
  const db = await getDb();
  if (!db) return [];
  
  const dateLimit = new Date();
  dateLimit.setDate(dateLimit.getDate() - days);

  return db.select()
    .from(dataQualityHistory)
    .where(and(
      eq(dataQualityHistory.assetId, assetId),
      gte(dataQualityHistory.measuredAt, dateLimit)
    ))
    .orderBy(asc(dataQualityHistory.measuredAt));
}

// ─── Data Attributes ──────────────────────────────────────────────────────────
export async function getDataAttributes(assetId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dataAttributes).where(eq(dataAttributes.assetId, assetId)).orderBy(dataAttributes.name);
}

export async function createDataAttribute(data: InsertDataAttribute) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [inserted] = await db.insert(dataAttributes).values(data).returning();
  return inserted;
}

export async function updateDataAttribute(id: number, data: Partial<InsertDataAttribute>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(dataAttributes).set(data).where(eq(dataAttributes.id, id));
}

// ─── Data Lineage ─────────────────────────────────────────────────────────────
export async function getDataLineage(assetId: number) {
  const db = await getDb();
  if (!db) return [];

  const queue = [assetId];
  const visitedAssets = new Set<number>();
  const collectedEdges = new Map<number, unknown>();

  while (queue.length > 0) {
    const currentAssetId = queue.shift()!;
    if (visitedAssets.has(currentAssetId)) continue;
    visitedAssets.add(currentAssetId);

    const relatedEdges = await db.select().from(dataLineage).where(
      sql`${dataLineage.sourceAssetId} = ${currentAssetId} OR ${dataLineage.targetAssetId} = ${currentAssetId}`
    );

    for (const edge of relatedEdges) {
      collectedEdges.set(edge.id, edge);
      if (!visitedAssets.has(edge.sourceAssetId)) queue.push(edge.sourceAssetId);
      if (!visitedAssets.has(edge.targetAssetId)) queue.push(edge.targetAssetId);
    }
  }

  return Array.from(collectedEdges.values()).sort((a: any, b: any) => a.id - b.id);
}

export async function createDataLineage(data: InsertDataLineage) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(dataLineage).values(data);
}

export async function getAllDataLineage() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dataLineage).orderBy(desc(dataLineage.createdAt));
}

/**
 * Importa edges de lineagem em lote, resolvendo nomes de ativos para IDs.
 * Ignora edges cujos nomes não existam no catálogo.
 * Retorna { imported, skipped }.
 */
export async function importLineageEdges(edges: Array<{
  sourceName: string;
  targetName: string;
  type: "direto" | "transformado" | "agregado";
  transformationRule?: string;
  sourceColumn?: string;
  targetColumn?: string;
}>): Promise<{ imported: number; skipped: number }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const allAssets = await getDataAssets();
  const nameMap = new Map(allAssets.map(a => [a.name.toUpperCase(), a.id]));

  const resolveAssetId = (edgeName: string): number | undefined => {
    const edgeUpper = edgeName.toUpperCase();
    if (nameMap.has(edgeUpper)) return nameMap.get(edgeUpper);

    // Busca exata por fullyQualifiedName
    const fqnMatch = allAssets.find(a => a.fullyQualifiedName?.toUpperCase() === edgeUpper);
    if (fqnMatch) return fqnMatch.id;

    // Busca flexível de sufixo (ex: "dim_canal" casa com "atendimento_satisfacao.dim_canal")
    const suffixMatches = allAssets.filter(a => {
      const assetNameUpper = a.name.toUpperCase();
      const assetFqnUpper = a.fullyQualifiedName?.toUpperCase();
      return assetNameUpper === edgeUpper || 
             assetNameUpper.endsWith("." + edgeUpper) ||
             (assetFqnUpper && (assetFqnUpper === edgeUpper || assetFqnUpper.endsWith("." + edgeUpper)));
    });

    if (suffixMatches.length === 1) return suffixMatches[0].id;

    const reverseMatches = allAssets.filter(a => {
      const assetNameUpper = a.name.toUpperCase();
      return edgeUpper.endsWith("." + assetNameUpper) || assetNameUpper.endsWith("." + edgeUpper);
    });
    if (reverseMatches.length === 1) return reverseMatches[0].id;

    return undefined;
  };

  let imported = 0;
  let skipped = 0;

  for (const edge of edges) {
    const sourceId = resolveAssetId(edge.sourceName);
    const targetId = resolveAssetId(edge.targetName);
    
    console.log(`[ImportLog] Edge: ${edge.sourceName} -> ${edge.targetName} | IDs: ${sourceId} -> ${targetId}`);

    if (!sourceId || !targetId || sourceId === targetId) { 
      console.log(`[ImportLog] Skipped: ${!sourceId ? 'Source missing' : !targetId ? 'Target missing' : 'Circular'}`);
      skipped++; 
      continue; 
    }

    // Verificar se a edge já existe
    const exists = await db.select({ id: dataLineage.id })
      .from(dataLineage)
      .where(and(
        eq(dataLineage.sourceAssetId, sourceId),
        eq(dataLineage.targetAssetId, targetId)
      ))
      .limit(1);

    if (exists.length > 0) { skipped++; continue; }

    await db.insert(dataLineage).values({
      sourceAssetId: sourceId,
      targetAssetId: targetId,
      type: edge.type,
      transformationRule: edge.transformationRule ?? null,
      sourceColumn: edge.sourceColumn ?? null,
      targetColumn: edge.targetColumn ?? null,
    });
    imported++;
  }

  return { imported, skipped };
}

// ─── Data Quality ─────────────────────────────────────────────────────────────
export async function getDataQualityChecks(assetId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dataQualityChecks).where(eq(dataQualityChecks.assetId, assetId)).orderBy(desc(dataQualityChecks.lastRunAt));
}

export async function createDataQualityCheck(data: InsertDataQualityCheck) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  console.log(`[DB] createDataQualityCheck: assetId=${data.assetId}, metric=${data.metricName}, score=${data.score}, status=${data.status}`);
  const result = await db.insert(dataQualityChecks).values(data);
  console.log(`[DB] createDataQualityCheck: insert OK para assetId=${data.assetId}`);
  return result;
}

export async function getQualityRules(assetId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(qualityRules).where(eq(qualityRules.assetId, assetId));
}

export async function upsertQualityRule(data: InsertQualityRule) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  
  // Custom conflict target based on dimension and scope (asset/domain)
  // For simplicity, we just delete existing rules for this asset+dimension and insert the new one
  if (data.assetId && data.dimensionId) {
    await db.delete(qualityRules).where(
      and(
        eq(qualityRules.assetId, data.assetId),
        eq(qualityRules.dimensionId, data.dimensionId)
      )
    );
  }

  return db.insert(qualityRules).values(data);
}

// ─── Access Requests (Fila de Aprovação) ────────────────────────────────────
export async function createAccessRequest(data: InsertAccessRequest) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(accessRequests).values(data);
  return result;
}

export async function getAccessRequests(opts: {
  status?: string;
  assetId?: number;
  requesterId?: number;
  // ownerId e stewardId aqui são users.id (usuário logado).
  // A função resolve internamente para participants.id via JOIN.
  ownerId?: number;
  stewardId?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  // Resolve users.id → participants.id para ownerId
  let ownerParticipantId: number | undefined;
  if (opts.ownerId) {
    const rows = await db.select({ id: participants.id })
      .from(participants)
      .where(eq(participants.userId, opts.ownerId))
      .limit(1);
    ownerParticipantId = rows[0]?.id;
    if (!ownerParticipantId) return []; // usuário não tem participante vinculado
  }

  // Resolve users.id → participants.id para stewardId
  let stewardParticipantId: number | undefined;
  if (opts.stewardId) {
    const rows = await db.select({ id: participants.id })
      .from(participants)
      .where(eq(participants.userId, opts.stewardId))
      .limit(1);
    stewardParticipantId = rows[0]?.id;
    if (!stewardParticipantId) return []; // usuário não tem participante vinculado
  }

  const conditions: any[] = [];
  if (opts.status) conditions.push(eq(accessRequests.status, opts.status as any));
  if (opts.assetId) conditions.push(eq(accessRequests.assetId, opts.assetId));
  if (opts.requesterId) conditions.push(eq(accessRequests.requesterId, opts.requesterId));
  if (ownerParticipantId) conditions.push(eq(accessRequests.ownerId, ownerParticipantId));
  if (stewardParticipantId) conditions.push(eq(accessRequests.stewardId, stewardParticipantId));

  const baseQuery = db
    .select({
      id: accessRequests.id,
      ticketNumber: accessRequests.ticketNumber,
      assetId: accessRequests.assetId,
      requesterId: accessRequests.requesterId,
      requesterName: accessRequests.requesterName,
      requesterEmail: accessRequests.requesterEmail,
      nivelAcesso: accessRequests.nivelAcesso,
      papelGrupo: accessRequests.papelGrupo,
      baseLegal: accessRequests.baseLegal,
      finalidade: accessRequests.finalidade,
      prazoNecessidade: accessRequests.prazoNecessidade,
      checklistJson: accessRequests.checklistJson,
      envolveTerceiros: accessRequests.envolveTerceiros,
      statusOwner: accessRequests.statusOwner,
      ownerApprovedAt: accessRequests.ownerApprovedAt,
      ownerComment: accessRequests.ownerComment,
      ownerId: accessRequests.ownerId,
      statusSteward: accessRequests.statusSteward,
      stewardApprovedAt: accessRequests.stewardApprovedAt,
      stewardComment: accessRequests.stewardComment,
      stewardId: accessRequests.stewardId,
      status: accessRequests.status,
      flowType: accessRequests.flowType,
      priority: accessRequests.priority,
      createdAt: accessRequests.createdAt,
      updatedAt: accessRequests.updatedAt,
      // Dados do ativo via JOIN
      assetName: dataAssets.name,
      assetType: dataAssets.type,
      assetSensitivity: dataAssets.sensitivity,
      assetCriticality: dataAssets.criticality,
      assetBusinessArea: dataAssets.businessArea,
      assetSourceSystem: dataAssets.sourceSystem,
    })
    .from(accessRequests)
    .leftJoin(dataAssets, eq(accessRequests.assetId, dataAssets.id))
    .$dynamic();

  let q = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;
  return q.orderBy(desc(accessRequests.createdAt));
}

export async function getAccessRequestById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(accessRequests).where(eq(accessRequests.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function approveByOwner(id: number, comment: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(accessRequests).set({
    statusOwner: "aprovado",
    ownerApprovedAt: new Date(),
    ownerComment: comment,
    status: "pendente_steward",
    statusSteward: "pendente",
  }).where(eq(accessRequests.id, id));
}

export async function rejectByOwner(id: number, comment: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(accessRequests).set({
    statusOwner: "rejeitado",
    ownerApprovedAt: new Date(),
    ownerComment: comment,
    status: "rejeitado_owner",
  }).where(eq(accessRequests.id, id));
}

export async function approveBySteward(id: number, comment: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(accessRequests).set({
    statusSteward: "aprovado",
    stewardApprovedAt: new Date(),
    stewardComment: comment,
    status: "aprovado",
  }).where(eq(accessRequests.id, id));
}

export async function rejectBySteward(id: number, comment: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(accessRequests).set({
    statusSteward: "rejeitado",
    stewardApprovedAt: new Date(),
    stewardComment: comment,
    status: "rejeitado_steward",
  }).where(eq(accessRequests.id, id));
}

// ─── ServiceNow Tickets ──────────────────────────────────────────────────────
export async function createServiceNowTicket(data: InsertServicenowTicket) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(servicenowTickets).values(data);
}

export async function getServiceNowTickets(opts?: { assetId?: number; domainId?: number }) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(servicenowTickets).$dynamic();
  
  const conditions = [];
  if (opts?.assetId) conditions.push(eq(servicenowTickets.participantId, opts.assetId)); // Usando participantId como ref temporária ou similar
  if (opts?.domainId) conditions.push(eq(servicenowTickets.domainId, opts.domainId));
  
  if (conditions.length > 0) query = query.where(and(...conditions));
  return query.orderBy(desc(servicenowTickets.createdAt));
}

// ─── Audit Log ───────────────────────────────────────────────────────────────
export async function createAuditLog(data: Omit<InsertAuditLog, 'id' | 'createdAt'>) {
  const db = await getDb();
  if (!db) return; // silently skip if no DB (dev mode without DB)
  try {
    await db.insert(auditLog).values(data as InsertAuditLog);
  } catch {
    // Nunca deixar o audit log quebrar o fluxo principal
  }
}

export async function getAuditLogs(opts: {
  userId?: number;
  action?: string;
  entity?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
} = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: ReturnType<typeof eq>[] = [];
  if (opts.userId) conditions.push(eq(auditLog.userId, opts.userId));
  if (opts.action) conditions.push(eq(auditLog.action, opts.action as InsertAuditLog['action']));
  if (opts.entity) conditions.push(eq(auditLog.entity, opts.entity));
  let q = db.select().from(auditLog).$dynamic();
  if (conditions.length > 0) q = q.where(and(...conditions));
  return q
    .orderBy(desc(auditLog.createdAt))
    .limit(opts.limit ?? 100)
    .offset(opts.offset ?? 0);
}

// ─── Business Glossary ───────────────────────────────────────────────────────
export async function getGlossaryTerms(opts: {
  status?: string;
  category?: string;
  search?: string;
  domainId?: number;
} = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: ReturnType<typeof eq>[] = [];
  if (opts.status) conditions.push(eq(businessGlossary.status, opts.status as any));
  if (opts.category) conditions.push(eq(businessGlossary.category, opts.category));
  if (opts.domainId) conditions.push(eq(businessGlossary.domainId, opts.domainId));
  if (opts.search) {
    conditions.push(
      sql`(${businessGlossary.term} ILIKE ${'%' + opts.search + '%'} OR ${businessGlossary.definition} ILIKE ${'%' + opts.search + '%'})` as any
    );
  }
  let q = db.select().from(businessGlossary).$dynamic();
  if (conditions.length > 0) q = q.where(and(...conditions));
  return q.orderBy(businessGlossary.term);
}

export async function getGlossaryTermById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(businessGlossary).where(eq(businessGlossary.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createGlossaryTerm(data: Omit<InsertBusinessGlossaryTerm, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const [inserted] = await db.insert(businessGlossary).values(data as InsertBusinessGlossaryTerm).returning();
  return inserted;
}

export async function updateGlossaryTerm(id: number, data: Partial<InsertBusinessGlossaryTerm>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  return db.update(businessGlossary).set({ ...data, updatedAt: new Date() }).where(eq(businessGlossary.id, id));
}

export async function deleteGlossaryTerm(id: number) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  return db.delete(businessGlossary).where(eq(businessGlossary.id, id));
}

export async function getGlossaryCategories() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ category: businessGlossary.category })
    .from(businessGlossary)
    .where(isNotNull(businessGlossary.category))
    .groupBy(businessGlossary.category)
    .orderBy(businessGlossary.category);
  return rows.map(r => r.category).filter(Boolean) as string[];
}

// ─── Organizations ────────────────────────────────────────────────────────────
export async function getOrganizations() {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(organizations).orderBy(organizations.name);
  } catch (err: any) {
    console.error("[getOrganizations] Erro na query:", err?.message);
    return [];
  }
}

export async function getOrganizationById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createOrganization(data: Omit<InsertOrganization, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const [inserted] = await db.insert(organizations).values(data as InsertOrganization).returning();
  return inserted;
}

export async function updateOrganization(id: number, data: Partial<InsertOrganization>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  return db.update(organizations).set({ ...data, updatedAt: new Date() }).where(eq(organizations.id, id));
}

/**
 * Retorna os contadores de uso atual de uma organização para verificação de quotas de plano.
 * Usado no enforcement de maxUsers e maxAssets antes de criar novos registros.
 */
export async function getOrganizationUsage(orgId: number): Promise<{ userCount: number; assetCount: number }> {
  const db = await getDb();
  if (!db) return { userCount: 0, assetCount: 0 };

  const [userRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(users)
    .where(eq(users.organizationId, orgId));

  const [assetRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(dataAssets)
    .where(and(
      eq(dataAssets.organizationId, orgId),
      eq(dataAssets.status, 'ativo')
    ));

  return {
    userCount: Number(userRow?.count ?? 0),
    assetCount: Number(assetRow?.count ?? 0),
  };
}

// ─── SLA Configs ──────────────────────────────────────────────────────────────
export async function getSlaConfigs(opts?: { entityType?: string; entityId?: number; active?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (opts?.entityType) conditions.push(eq(slaConfigs.entityType, opts.entityType as any));
  if (opts?.entityId) conditions.push(eq(slaConfigs.entityId, opts.entityId));
  if (opts?.active !== undefined) conditions.push(eq(slaConfigs.active, opts.active));
  const q = db.select().from(slaConfigs);
  return conditions.length > 0 ? q.where(and(...conditions)) : q;
}

export async function getSlaConfigById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(slaConfigs).where(eq(slaConfigs.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createSlaConfig(data: Omit<InsertSlaConfig, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  return db.insert(slaConfigs).values(data as InsertSlaConfig);
}

export async function updateSlaConfig(id: number, data: Partial<InsertSlaConfig>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  return db.update(slaConfigs).set({ ...data, updatedAt: new Date() }).where(eq(slaConfigs.id, id));
}

export async function deleteSlaConfig(id: number) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  return db.delete(slaConfigs).where(eq(slaConfigs.id, id));
}

export async function getSlaViolations(opts?: { resolved?: boolean; entityType?: string; limit?: number; offset?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (opts?.resolved === false) conditions.push(isNull(slaViolations.resolvedAt));
  if (opts?.resolved === true) conditions.push(isNotNull(slaViolations.resolvedAt));
  if (opts?.entityType) conditions.push(eq(slaViolations.entityType, opts.entityType as any));
  const q = db.select().from(slaViolations).orderBy(desc(slaViolations.detectedAt))
    .limit(opts?.limit ?? 100).offset(opts?.offset ?? 0);
  return conditions.length > 0 ? q.where(and(...conditions)) : q;
}

export async function createSlaViolation(data: Omit<InsertSlaViolation, 'id' | 'detectedAt'>) {
  const db = await getDb();
  if (!db) return;
  await db.insert(slaViolations).values(data as InsertSlaViolation);
}

export async function resolveSlaViolation(id: number) {
  const db = await getDb();
  if (!db) return;
  return db.update(slaViolations).set({ resolvedAt: new Date() }).where(eq(slaViolations.id, id));
}

// ─── Global Quality Dimensions (agregação por métrica) ───────────────────────
export async function getGlobalQualityDimensions() {
  const db = await getDb();
  if (!db) return [];

  return db.select({
    metricName: dataQualityChecks.metricName,
    avgScore: sql<number>`ROUND(AVG(${dataQualityChecks.score})::numeric, 1)`,
    totalChecks: sql<number>`COUNT(*)`,
  })
    .from(dataQualityChecks)
    .groupBy(dataQualityChecks.metricName)
    .orderBy(dataQualityChecks.metricName);
}

// ─── Data Quality History ───────────────────────────────────────────────────
export async function snapshotQualityMetrics() {
  const db = await getDb();
  if (!db) return;

  const assets = await db.select({
    id: dataAssets.id,
    qualityScore: dataAssets.qualityScore,
    organizationId: dataAssets.organizationId,
  }).from(dataAssets);

  if (assets.length === 0) return;

  const snapshots: InsertDataQualityHistory[] = assets.map(a => ({
    assetId: a.id,
    avgScore: a.qualityScore ?? 0,
    organizationId: a.organizationId ?? 1,
    measuredAt: new Date()
  }));

  // Inserção em pequenos lotes para evitar estourar limites de query
  for (let i = 0; i < snapshots.length; i += 50) {
    const chunk = snapshots.slice(i, i + 50);
    await db.insert(dataQualityHistory).values(chunk);
  }

  console.log(`[Snapshot] Registrado histórico de qualidade para ${snapshots.length} ativos.`);
}

export async function getQualityTrend(assetId?: number, days = 30) {
  const db = await getDb();
  if (!db) return [];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const conditions = [gte(dataQualityHistory.measuredAt, startDate)];
  if (assetId) conditions.push(eq(dataQualityHistory.assetId, assetId));

  return db.select()
    .from(dataQualityHistory)
    .where(and(...conditions))
    .orderBy(dataQualityHistory.measuredAt);
}

// ─── Tendência Global por Organização
export async function getGlobalQualityTrend(organizationId = 1, days = 30) {
  const db = await getDb();
  if (!db) return [];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Média diária de todos os ativos da organização
  return db.select({
    date: sql<string>`DATE(${dataQualityHistory.measuredAt})`,
    avgScore: sql<number>`AVG(${dataQualityHistory.avgScore})`,
    totalAssets: sql<number>`COUNT(DISTINCT ${dataQualityHistory.assetId})`,
  })
    .from(dataQualityHistory)
    .where(and(
      eq(dataQualityHistory.organizationId, organizationId),
      gte(dataQualityHistory.measuredAt, startDate)
    ))
    .groupBy(sql`DATE(${dataQualityHistory.measuredAt})`)
    .orderBy(sql`DATE(${dataQualityHistory.measuredAt})`);
}

// ─── Maturity Score (calculado dinamicamente) ─────────────────────────────────
export async function getMaturityScore() {
  const db = await getDb();
  if (!db) return null;

  const ownerAlias = alias(participants, 'maturity_owner');
  const stewardAlias = alias(participants, 'maturity_steward');

  const [totalAssetsRow] = await db.select({ cnt: count() }).from(dataAssets);
  const totalAssets = totalAssetsRow?.cnt ?? 0;

  const [withDescRow] = await db.select({ cnt: count() }).from(dataAssets)
    .where(and(
      isNotNull(dataAssets.description), 
      sql`LENGTH(TRIM(${dataAssets.description})) > 0`,
      sql`NOT EXISTS (SELECT 1 FROM data_attributes WHERE asset_id = ${dataAssets.id} AND (description IS NULL OR LENGTH(TRIM(description)) = 0))`
    ));
  const withDesc = withDescRow?.cnt ?? 0;

  const [withOwnerRow] = await db
    .select({ cnt: count() })
    .from(dataAssets)
    .innerJoin(ownerAlias, eq(dataAssets.ownerId, ownerAlias.id));
  const withOwner = withOwnerRow?.cnt ?? 0;

  const [withStewardRow] = await db
    .select({ cnt: count() })
    .from(dataAssets)
    .innerJoin(stewardAlias, eq(dataAssets.stewardId, stewardAlias.id));
  const withSteward = withStewardRow?.cnt ?? 0;

  const [highQualityRow] = await db.select({ cnt: count() }).from(dataAssets)
    .where(gte(dataAssets.qualityScore, 70));
  const highQuality = highQualityRow?.cnt ?? 0;

  const [totalArRow] = await db.select({ cnt: count() }).from(accessRequests);
  const [resolvedArRow] = await db.select({ cnt: count() }).from(accessRequests)
    .where(sql`status NOT IN ('pendente_owner','pendente_steward')`);

  const [glossaryApprovedRow] = await db.select({ cnt: count() }).from(businessGlossary)
    .where(eq(businessGlossary.status, 'aprovado'));

  const [totalDomainsRow] = await db.select({ cnt: count() }).from(domains);

  const safe = (n: number, d: number) => d === 0 ? 0 : Math.round((n / d) * 100);

  const scores = {
    descricao: safe(withDesc, totalAssets),
    governanca: Math.round((safe(withOwner, totalAssets) + safe(withSteward, totalAssets)) / 2),
    qualidade: safe(highQuality, totalAssets),
    acessos: safe(resolvedArRow?.cnt ?? 0, totalArRow?.cnt ?? 1),
    glossario: Math.min(100, Math.round(((glossaryApprovedRow?.cnt ?? 0) / 10) * 100)),
  };
  const overall = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length);

  return {
    overall,
    scores,
    stats: {
      totalAssets,
      withDesc,
      withOwner,
      withSteward,
      highQuality,
      totalAccessRequests: totalArRow?.cnt ?? 0,
      resolvedAccessRequests: resolvedArRow?.cnt ?? 0,
      glossaryApproved: glossaryApprovedRow?.cnt ?? 0,
      totalDomains: totalDomainsRow?.cnt ?? 0,
    },
  };
}

export async function getMaturityDrilldown() {
  const db = await getDb();
  if (!db) return null;

  const ownerAlias = alias(participants, 'dd_owner');
  const stewardAlias = alias(participants, 'dd_steward');

  // Todos os ativos (para badge Ativos Globais sempre clicável)
  const allAssets = await db
    .select({ id: dataAssets.id, name: dataAssets.name, type: dataAssets.type, qualityScore: dataAssets.qualityScore, region: dataAssets.region, sourceSystem: dataAssets.sourceSystem })
    .from(dataAssets)
    .orderBy(dataAssets.name)
    .limit(100);

  // Ativos sem descrição
  const missingDesc = await db
    .select({ id: dataAssets.id, name: dataAssets.name, type: dataAssets.type })
    .from(dataAssets)
    .where(
      or(
        isNull(dataAssets.description), 
        sql`LENGTH(TRIM(${dataAssets.description})) = 0`,
        sql`EXISTS (SELECT 1 FROM data_attributes WHERE asset_id = ${dataAssets.id} AND (description IS NULL OR LENGTH(TRIM(description)) = 0))`
      )
    )
    .limit(50);

  // Ativos sem Data Owner
  const missingOwner = await db
    .select({ id: dataAssets.id, name: dataAssets.name, type: dataAssets.type })
    .from(dataAssets)
    .leftJoin(ownerAlias, eq(dataAssets.ownerId, ownerAlias.id))
    .where(isNull(ownerAlias.id))
    .limit(50);

  // Ativos sem Steward
  const missingSteward = await db
    .select({ id: dataAssets.id, name: dataAssets.name, type: dataAssets.type })
    .from(dataAssets)
    .leftJoin(stewardAlias, eq(dataAssets.stewardId, stewardAlias.id))
    .where(isNull(stewardAlias.id))
    .limit(50);

  // Ativos com baixa qualidade (< 70)
  const lowQuality = await db
    .select({ id: dataAssets.id, name: dataAssets.name, type: dataAssets.type, qualityScore: dataAssets.qualityScore })
    .from(dataAssets)
    .where(sql`(${dataAssets.qualityScore} IS NULL OR ${dataAssets.qualityScore} < 70)`)
    .limit(50);

  // Solicitações de acesso pendentes
  const pendingAccess = await db
    .select({ id: accessRequests.id, ticketNumber: accessRequests.ticketNumber, requesterName: accessRequests.requesterName, status: accessRequests.status, assetId: accessRequests.assetId })
    .from(accessRequests)
    .where(sql`status IN ('pendente_owner','pendente_steward')`)
    .limit(50);

  // Termos do glossário não aprovados
  const pendingGlossary = await db
    .select({ id: businessGlossary.id, term: businessGlossary.term, status: businessGlossary.status, category: businessGlossary.category })
    .from(businessGlossary)
    .where(sql`status != 'aprovado'`)
    .limit(50);

  return {
    allAssets,
    missingDesc,
    missingOwner,
    missingSteward,
    lowQuality,
    pendingAccess,
    pendingGlossary,
  };
}

export async function getDomainQualityTrend() {
  const db = await getDb();
  if (!db) return [];

  // Busca qualidade média por domínio
  const result = await db.select({
    domainId: domains.id,
    domainName: domains.name,
    avgScore: sql<number>`AVG(${dataAssets.qualityScore})`,
    assetCount: count(dataAssets.id),
  })
  .from(domains)
  .leftJoin(dataAssets, eq(domains.id, dataAssets.domainId))
  .groupBy(domains.id, domains.name);

  return result.map(r => ({
    name: r.domainName,
    value: Math.round(r.avgScore || 0),
    assets: r.assetCount,
  }));
}

// ─── LGPD / Dados Pessoais ────────────────────────────────────────────────────
export async function getLgpdAssets() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dataAssets)
    .where(sql`(
      sensitivity IN ('restrito','confidencial')
      OR description LIKE '%dado pessoal%'
      OR description LIKE '%dados pessoais%'
      OR description LIKE '%PII%'
      OR description LIKE '%CPF%'
      OR name LIKE '%CPF%'
      OR name LIKE '%pessoal%'
    )`)
    .orderBy(desc(dataAssets.updatedAt));
}

// ─── Webhooks ─────────────────────────────────────────────────────────────────
export async function getWebhookConfigs(activeOnly = false) {
  const db = await getDb();
  if (!db) return [];
  const q = db.select().from(webhookConfigs).orderBy(webhookConfigs.name);
  return activeOnly ? q.where(eq(webhookConfigs.active, true)) : q;
}

export async function getWebhookConfigById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(webhookConfigs).where(eq(webhookConfigs.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createWebhookConfig(data: Omit<InsertWebhookConfig, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  return db.insert(webhookConfigs).values(data as InsertWebhookConfig);
}

export async function updateWebhookConfig(id: number, data: Partial<InsertWebhookConfig>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  return db.update(webhookConfigs).set({ ...data, updatedAt: new Date() }).where(eq(webhookConfigs.id, id));
}

export async function deleteWebhookConfig(id: number) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  return db.delete(webhookConfigs).where(eq(webhookConfigs.id, id));
}

export async function getWebhookDeliveries(webhookConfigId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(webhookDeliveries)
    .where(eq(webhookDeliveries.webhookConfigId, webhookConfigId))
    .orderBy(desc(webhookDeliveries.deliveredAt)).limit(limit);
}

export async function dispatchWebhook(event: string, payload: Record<string, unknown>) {
  try {
    const configs = await getWebhookConfigs(true);
    for (const wh of configs) {
      const events = Array.isArray(wh.events) ? wh.events : [];
      if (!events.includes(event) && !events.includes('*')) continue;
      const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (wh.secret) {
        const sig = createHmac('sha256', wh.secret).update(body).digest('hex');
        headers['X-Webhook-Signature'] = `sha256=${sig}`;
      }
      try {
        const res = await fetch(wh.url as string, { method: 'POST', headers, body, signal: AbortSignal.timeout(10000) });
        const db = await getDb();
        if (db) {
          await db.insert(webhookDeliveries).values({
            webhookConfigId: wh.id, event, payload: payload as any,
            statusCode: res.status, success: res.ok, responseBody: (await res.text()).slice(0, 1000),
          } as InsertWebhookDelivery);
          if (!res.ok) {
            await db.update(webhookConfigs).set({ failureCount: (wh.failureCount ?? 0) + 1, lastStatusCode: res.status, lastTriggeredAt: new Date() }).where(eq(webhookConfigs.id, wh.id));
          } else {
            await db.update(webhookConfigs).set({ failureCount: 0, lastStatusCode: res.status, lastTriggeredAt: new Date() }).where(eq(webhookConfigs.id, wh.id));
          }
        }
      } catch {
        // silencioso
      }
    }
  } catch {
    // nunca quebra o fluxo principal
  }
}

// ─── SSO Configs ──────────────────────────────────────────────────────────────
export async function getSsoConfigByOrg(organizationId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(ssoConfigs).where(eq(ssoConfigs.organizationId, organizationId)).limit(1);
  return rows[0] ?? null;
}

export async function upsertSsoConfig(data: Omit<InsertSsoConfig, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const existing = await getSsoConfigByOrg(data.organizationId);
  if (existing) {
    return db.update(ssoConfigs).set({ ...data, updatedAt: new Date() }).where(eq(ssoConfigs.organizationId, data.organizationId));
  }
  return db.insert(ssoConfigs).values(data as InsertSsoConfig);
}

// ─── API Keys ─────────────────────────────────────────────────────────────────
export async function getApiKeys(userId?: number) {
  const db = await getDb();
  if (!db) return [];
  const q = db.select({
    id: apiKeys.id, name: apiKeys.name, keyPrefix: apiKeys.keyPrefix,
    scopes: apiKeys.scopes, active: apiKeys.active,
    lastUsedAt: apiKeys.lastUsedAt, expiresAt: apiKeys.expiresAt,
    createdById: apiKeys.createdById, createdAt: apiKeys.createdAt,
  }).from(apiKeys).orderBy(desc(apiKeys.createdAt));
  return userId ? q.where(eq(apiKeys.createdById, userId)) : q;
}

export async function createApiKey(name: string, scopes: string[], userId: number, expiresInDays?: number) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const raw = randomBytes(32).toString('hex');
  const prefix = raw.slice(0, 8);
  const keyHash = createHash('sha256').update(raw).digest('hex');
  const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86400000) : undefined;
  await db.insert(apiKeys).values({ name, keyHash, keyPrefix: prefix, scopes: scopes as any, createdById: userId, expiresAt } as InsertApiKey);
  return { key: `cgd_${raw}`, prefix, name, scopes }; // retorna a chave completa UMA vez
}

export async function revokeApiKey(id: number, userId: number, isAdmin: boolean) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  if (!isAdmin) {
    // só pode revogar própria chave
    return db.update(apiKeys).set({ active: false }).where(and(eq(apiKeys.id, id), eq(apiKeys.createdById, userId)));
  }
  return db.update(apiKeys).set({ active: false }).where(eq(apiKeys.id, id));
}

export async function validateApiKey(rawKey: string): Promise<{ userId: number; scopes: string[] } | null> {
  const db = await getDb();
  if (!db) return null;
  const stripped = rawKey.startsWith('cgd_') ? rawKey.slice(4) : rawKey;
  const keyHash = createHash('sha256').update(stripped).digest('hex');
  const rows = await db.select().from(apiKeys).where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.active, true))).limit(1);
  const key = rows[0];
  if (!key) return null;
  if (key.expiresAt && key.expiresAt < new Date()) return null;
  // atualiza lastUsedAt sem bloquear
  db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id)).catch(() => {});
  let parsedScopes: string[] = [];
  if (Array.isArray(key.scopes)) {
    parsedScopes = key.scopes as string[];
  } else if (typeof key.scopes === 'string') {
    try { parsedScopes = JSON.parse(key.scopes); } catch {}
  }
  return { userId: key.createdById, scopes: parsedScopes };
}

// ─── Data Contracts ──────────────────────────────────────────────────────────
export async function getDataContracts(opts?: { assetId?: number; status?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (opts?.assetId) conditions.push(eq(dataContracts.assetId, opts.assetId));
  if (opts?.status) conditions.push(eq(dataContracts.status, opts.status as DataContract["status"]));
  let q = db.select().from(dataContracts).$dynamic();
  if (conditions.length > 0) q = q.where(and(...conditions));
  return q.orderBy(desc(dataContracts.createdAt));
}

export async function getDataContractById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(dataContracts).where(eq(dataContracts.id, id)).limit(1);
  return result[0];
}

export async function createDataContract(data: InsertDataContract) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [inserted] = await db.insert(dataContracts).values(data).returning();
  return inserted;
}

export async function updateDataContract(id: number, data: Partial<InsertDataContract>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(dataContracts).set({ ...data, updatedAt: new Date() }).where(eq(dataContracts.id, id));
  return getDataContractById(id);
}

export async function deleteDataContract(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(dataContracts).where(eq(dataContracts.id, id));
  return { success: true };
}

// ─── PIA / DPIA Assessments ───────────────────────────────────────────────────
export async function getPiaAssessments(opts?: { status?: string; riskLevel?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (opts?.status) conditions.push(eq(piaAssessments.status, opts.status as any));
  if (opts?.riskLevel) conditions.push(eq(piaAssessments.riskLevel, opts.riskLevel as any));
  let q = db.select().from(piaAssessments).$dynamic();
  if (conditions.length > 0) q = q.where(and(...conditions));
  return q.orderBy(desc(piaAssessments.createdAt));
}

export async function getPiaAssessmentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(piaAssessments).where(eq(piaAssessments.id, id)).limit(1);
  return rows[0];
}

export async function createPiaAssessment(data: InsertPiaAssessment) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [inserted] = await db.insert(piaAssessments).values(data).returning();
  return inserted;
}

export async function updatePiaAssessment(id: number, data: Partial<InsertPiaAssessment>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(piaAssessments).set({ ...data, updatedAt: new Date() }).where(eq(piaAssessments.id, id));
  return getPiaAssessmentById(id);
}

export async function deletePiaAssessment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(piaAssessments).where(eq(piaAssessments.id, id));
  return { success: true };
}

// ─── DSAR — Data Subject Access Requests ─────────────────────────────────────
export async function getDsarRequests(opts?: { status?: string; requestType?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (opts?.status) conditions.push(eq(dsarRequests.status, opts.status as any));
  if (opts?.requestType) conditions.push(eq(dsarRequests.requestType, opts.requestType as any));
  let q = db.select().from(dsarRequests).$dynamic();
  if (conditions.length > 0) q = q.where(and(...conditions));
  return q.orderBy(desc(dsarRequests.createdAt));
}

export async function getDsarRequestById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(dsarRequests).where(eq(dsarRequests.id, id)).limit(1);
  return rows[0];
}

export async function createDsarRequest(data: InsertDsarRequest) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [inserted] = await db.insert(dsarRequests).values(data).returning();
  return inserted;
}

export async function updateDsarRequest(id: number, data: Partial<InsertDsarRequest>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(dsarRequests).set({ ...data, updatedAt: new Date() }).where(eq(dsarRequests.id, id));
  return getDsarRequestById(id);
}

export async function deleteDsarRequest(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(dsarRequests).where(eq(dsarRequests.id, id));
  return { success: true };
}

// ─── Connector Configs (Marketplace) ─────────────────────────────────────────
export async function getConnectorConfigs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(connectorConfigs).orderBy(connectorConfigs.name);
}

export async function getConnectorConfigById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(connectorConfigs).where(eq(connectorConfigs.id, id)).limit(1);
  return rows[0];
}

export async function createConnectorConfig(data: InsertConnectorConfig) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [inserted] = await db.insert(connectorConfigs).values(data).returning();
  return inserted;
}

export async function updateConnectorConfig(id: number, data: Partial<InsertConnectorConfig>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(connectorConfigs).set({ ...data, updatedAt: new Date() }).where(eq(connectorConfigs.id, id));
  return getConnectorConfigById(id);
}

export async function deleteConnectorConfig(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(connectorConfigs).where(eq(connectorConfigs.id, id));
  return { success: true };
}

export async function saveConnectorTestResult(id: number, success: boolean, message: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(connectorConfigs)
    .set({ lastTestedAt: new Date(), lastTestSuccess: success, lastTestMessage: message, updatedAt: new Date() })
    .where(eq(connectorConfigs.id, id));
  return getConnectorConfigById(id);
}

// ─── Workflow Engine ─────────────────────────────────────────────────────────

export async function getWorkflowDefinitions(orgId?: number) {
  const db = await getDb();
  if (!db) return [];
  const base = db.select().from(workflowDefinitions).orderBy(desc(workflowDefinitions.createdAt));
  if (orgId !== undefined) {
    return base.where(eq(workflowDefinitions.orgId, orgId));
  }
  return base;
}

export async function getWorkflowDefinitionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(workflowDefinitions).where(eq(workflowDefinitions.id, id)).limit(1);
  return rows[0];
}

export async function createWorkflowDefinition(data: InsertWorkflowDefinition) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [inserted] = await db.insert(workflowDefinitions).values(data).returning();
  return inserted;
}

export async function updateWorkflowDefinition(id: number, data: Partial<InsertWorkflowDefinition>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(workflowDefinitions).set({ ...data, updatedAt: new Date() }).where(eq(workflowDefinitions.id, id));
  return getWorkflowDefinitionById(id);
}

export async function deleteWorkflowDefinition(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(workflowDefinitions).where(eq(workflowDefinitions.id, id));
  return { success: true };
}

export async function getWorkflowInstances(opts: { entityType?: string; entityId?: number; status?: string }) {
  const db = await getDb();
  if (!db) return [];
  const filters: ReturnType<typeof eq>[] = [];
  if (opts.entityType) filters.push(eq(workflowInstances.entityType, opts.entityType));
  if (opts.entityId !== undefined) filters.push(eq(workflowInstances.entityId, opts.entityId));
  if (opts.status) filters.push(eq(workflowInstances.status, opts.status as WorkflowInstance["status"]));
  const base = db.select().from(workflowInstances).orderBy(desc(workflowInstances.startedAt));
  return filters.length > 0 ? base.where(and(...filters)) : base;
}

export async function getWorkflowInstanceById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(workflowInstances).where(eq(workflowInstances.id, id)).limit(1);
  return rows[0];
}

export async function createWorkflowInstance(data: InsertWorkflowInstance) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [inserted] = await db.insert(workflowInstances).values(data).returning();
  return inserted;
}

export async function updateWorkflowInstance(id: number, data: Partial<InsertWorkflowInstance>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(workflowInstances).set({ ...data, updatedAt: new Date() }).where(eq(workflowInstances.id, id));
  return getWorkflowInstanceById(id);
}

export async function getWorkflowStepActions(instanceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(workflowStepActions)
    .where(eq(workflowStepActions.instanceId, instanceId))
    .orderBy(workflowStepActions.createdAt);
}

export async function createWorkflowStepAction(data: InsertWorkflowStepAction) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [inserted] = await db.insert(workflowStepActions).values(data).returning();
  return inserted;
}

/** Retorna instâncias pendentes onde o usuário é aprovador no step atual */
export async function getMyWorkflowTasks(actorOpenId: string) {
  const db = await getDb();
  if (!db) return [];
  // Busca instâncias pending e filtra no JS (JSON não é indexável no MySQL facilmente)
  const instances = await db.select().from(workflowInstances)
    .where(eq(workflowInstances.status, "pending"))
    .orderBy(desc(workflowInstances.startedAt));

  // Para cada instância, verifica se o actor é aprovador do step atual
  const results: typeof instances = [];
  for (const inst of instances) {
    const def = await getWorkflowDefinitionById(inst.definitionId);
    if (!def) continue;
    const steps = def.stepsJson as Array<{ approvers?: string[]; type?: string }>;
    const stepDef = steps[inst.currentStep];
    if (stepDef?.approvers?.includes(actorOpenId)) {
      results.push(inst);
    }
  }
  return results;
}

// ─── Asset Comments ───────────────────────────────────────────────────────────
export async function getAssetComments(assetId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(assetComments)
    .where(eq(assetComments.assetId, assetId))
    .orderBy(assetComments.createdAt);
}

export async function createAssetComment(data: InsertAssetComment) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [inserted] = await db.insert(assetComments).values(data).returning();
  return inserted;
}

export async function updateAssetComment(id: number, userId: number, content: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(assetComments)
    .set({ content, updatedAt: new Date() })
    .where(and(eq(assetComments.id, id), eq(assetComments.userId, userId)));
}

export async function resolveAssetComment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(assetComments).set({ resolved: 1 }).where(eq(assetComments.id, id));
}

export async function deleteAssetComment(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(assetComments)
    .where(and(eq(assetComments.id, id), eq(assetComments.userId, userId)));
}

// ─── Intake de Demandas ───────────────────────────────────────────────────────
export async function getIntakeRequests(filters: {
  status?: string;
  submittedById?: number;
  domainId?: number;
  priority?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters.status) conditions.push(eq(intakeRequests.status, filters.status as any));
  if (filters.submittedById) conditions.push(eq(intakeRequests.submittedById, filters.submittedById));
  if (filters.domainId) conditions.push(eq(intakeRequests.domainId, filters.domainId));
  if (filters.priority) conditions.push(eq(intakeRequests.priority, filters.priority as any));
  const query = db.select().from(intakeRequests);
  const result = conditions.length
    ? await query.where(and(...conditions)).orderBy(desc(intakeRequests.createdAt)).limit(filters.limit ?? 100).offset(filters.offset ?? 0)
    : await query.orderBy(desc(intakeRequests.createdAt)).limit(filters.limit ?? 100).offset(filters.offset ?? 0);
  return result;
}

export async function getIntakeRequestById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(intakeRequests).where(eq(intakeRequests.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function generateIntakeCode(): Promise<string> {
  const db = await getDb();
  if (!db) return `INT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-001`;
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `INT-${datePart}-`;
  const [row] = await db.select({ cnt: count() }).from(intakeRequests)
    .where(like(intakeRequests.intakeCode, `${prefix}%`));
  const seq = String(((row?.cnt ?? 0) + 1)).padStart(3, "0");
  return `${prefix}${seq}`;
}

export async function createIntakeRequest(data: InsertIntakeRequest) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(intakeRequests).values(data);
}

export async function updateIntakeRequest(id: number, data: Partial<InsertIntakeRequest>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(intakeRequests).set(data).where(eq(intakeRequests.id, id));
}

export async function deleteIntakeRequest(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(intakeRequests).where(eq(intakeRequests.id, id));
}

export async function countIntakeRequests(filters: { status?: string } = {}) {
  const db = await getDb();
  if (!db) return 0;
  const conditions = [];
  if (filters.status) conditions.push(eq(intakeRequests.status, filters.status as any));
  const [row] = conditions.length
    ? await db.select({ cnt: count() }).from(intakeRequests).where(and(...conditions))
    : await db.select({ cnt: count() }).from(intakeRequests);
  return row?.cnt ?? 0;
}

// Ranking: demandas com score, ordenadas por (impacto - esforço) decrescente
export async function getIntakeRanking() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(intakeRequests)
    .where(and(
      isNotNull(intakeRequests.impactScore),
      isNotNull(intakeRequests.effortScore),
    ))
    .orderBy(
      desc(intakeRequests.impactScore),
      asc(intakeRequests.effortScore),
      desc(intakeRequests.createdAt),
    )
    .limit(100);
}

// Iniciar execução de uma demanda aprovada
export async function startIntakeExecution(id: number, data: {
  executorId: number; executorName: string; executionNotes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(intakeRequests).set({
    status: "em_execucao",
    executorId: data.executorId,
    executorName: data.executorName,
    executionNotes: data.executionNotes ?? null,
    executionStartedAt: new Date(),
  }).where(eq(intakeRequests.id, id));
}

// Marcar como entregue (aguardando validação)
export async function deliverIntake(id: number, data: {
  deliveryNotes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(intakeRequests).set({
    status: "em_validacao",
    deliveredAt: new Date(),
    deliveryNotes: data.deliveryNotes ?? null,
  }).where(eq(intakeRequests.id, id));
}

// Validar entrega final (Data Owner)
export async function validateIntake(id: number, data: {
  validatedById: number; validatedByName: string; deliveryNotes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(intakeRequests).set({
    status: "concluido",
    validatedAt: new Date(),
    validatedById: data.validatedById,
    validatedByName: data.validatedByName,
    deliveryNotes: data.deliveryNotes ?? null,
  }).where(eq(intakeRequests.id, id));
}

// ─── Tag Policies (Taxonomia de Tags Governadas — Unity Catalog) ─────────────

export async function getTagPolicies(): Promise<TagPolicy[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tagPolicies).orderBy(tagPolicies.tagKey);
}

export async function getTagPolicyByKey(tagKey: string): Promise<TagPolicy | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db.select().from(tagPolicies).where(eq(tagPolicies.tagKey, tagKey));
  return row;
}

export async function createTagPolicy(data: Omit<InsertTagPolicy, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) throw new Error('DB não disponível');
  return db.insert(tagPolicies).values(data as InsertTagPolicy);
}

export async function updateTagPolicy(id: number, data: Partial<InsertTagPolicy>) {
  const db = await getDb();
  if (!db) throw new Error('DB não disponível');
  return db.update(tagPolicies)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(tagPolicies.id, id));
}

export async function deleteTagPolicy(id: number) {
  const db = await getDb();
  if (!db) throw new Error('DB não disponível');
  return db.delete(tagPolicies).where(eq(tagPolicies.id, id));
}

export async function getTagPolicyStats() {
  const db = await getDb();
  if (!db) return { totalPolicies: 0, totalTaggedAttributes: 0, pendingSync: 0, compliancePct: 0, verifiedAttributes: 0, totalAttributes: 0 };

  const [polRow]   = await db.select({ c: count() }).from(tagPolicies);
  const [totRow]   = await db.select({ c: count() }).from(dataAttributes);
  const [taggedRow]= await db.select({ c: count() }).from(dataAttributes).where(isNotNull(dataAttributes.aiSuggestion));
  const [verRow]   = await db.select({ c: count() }).from(dataAttributes).where(eq(dataAttributes.isVerified, true));

  // Ativos Databricks com colunas verificadas mas nunca sincronizadas
  const pendingRows = await db
    .selectDistinct({ assetId: dataAttributes.assetId })
    .from(dataAttributes)
    .innerJoin(dataAssets, eq(dataAttributes.assetId, dataAssets.id))
    .where(and(
      eq(dataAttributes.isVerified, true),
      eq(dataAssets.sourceSystem, 'Databricks'),
      isNull(dataAttributes.lastSyncedAt),
    ));

  const total = Number(totRow?.c ?? 0);
  const verified = Number(verRow?.c ?? 0);

  return {
    totalPolicies:          Number(polRow?.c ?? 0),
    totalTaggedAttributes:  Number(taggedRow?.c ?? 0),
    pendingSync:            pendingRows.length,
    compliancePct:          total > 0 ? Math.round((verified / total) * 100) : 0,
    verifiedAttributes:     verified,
    totalAttributes:        total,
  };
}

// Conta quantos atributos mencionam cada tagKey no aiSuggestion (contagem aproximada por LIKE)
export async function getTagAssignmentCounts(tagKeys: string[]): Promise<Record<string, number>> {
  const db = await getDb();
  if (!db || tagKeys.length === 0) return {};
  const result: Record<string, number> = {};
  await Promise.all(tagKeys.map(async (key) => {
    const [row] = await db
      .select({ c: count() })
      .from(dataAttributes)
      .where(sql`aiSuggestion LIKE ${`%"${key}"%`}`);
    result[key] = Number(row?.c ?? 0);
  }));
  return result;
}


// ─── Tier Sync Log ─────────────────────────────────────────────────────────────
export async function insertTierSyncLog(data: Omit<InsertTierSyncLog, 'id' | 'syncedAt'>): Promise<TierSyncLog> {
  const dbConn = await getDb();
  if (!dbConn) throw new Error('DB not available');
  const [row] = await dbConn.insert(tierSyncLog).values(data as InsertTierSyncLog).returning();
  return row;
}

export async function getTierSyncHistory(domainId?: number, limit = 50): Promise<TierSyncLog[]> {
  const dbConn = await getDb();
  if (!dbConn) return [];
  let q = dbConn.select().from(tierSyncLog).$dynamic();
  if (domainId !== undefined) {
    q = q.where(eq(tierSyncLog.domainId, domainId));
  }
  return q.orderBy(desc(tierSyncLog.syncedAt)).limit(limit);
}

// ─── Auditoria Databricks: Funções CRUD ──────────────────────────────────────
import { auditSessions, analysisResults } from "./db-auditoria";

export async function createAuditSession(data: any) {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("DB not available");
  const rows = await dbConn.insert(auditSessions).values(data).returning();
  return rows[0]?.id;
}

export async function updateAuditSession(id: number, data: any) {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("DB not available");
  return dbConn.update(auditSessions).set({ ...data, updatedAt: new Date() }).where(eq(auditSessions.id, id));
}

export async function getAuditSession(id: number) {
  const dbConn = await getDb();
  if (!dbConn) return null;
  const rows = await dbConn.select().from(auditSessions).where(eq(auditSessions.id, id));
  return rows[0] ?? null;
}

export async function getAuditSessionsByUser(userId: number) {
  const dbConn = await getDb();
  if (!dbConn) return [];
  return dbConn.select().from(auditSessions).where(eq(auditSessions.userId, userId)).orderBy(desc(auditSessions.createdAt));
}

export async function createAnalysisResult(data: any) {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("DB not available");
  const rows = await dbConn.insert(analysisResults).values(data).returning();
  return rows[0]?.id;
}

export async function updateAnalysisResult(id: number, data: any) {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("DB not available");
  return dbConn.update(analysisResults).set({ ...data, updatedAt: new Date() }).where(eq(analysisResults.id, id));
}

export async function getAnalysisResultsBySession(sessionId: number) {
  const dbConn = await getDb();
  if (!dbConn) return [];
  return dbConn.select().from(analysisResults).where(eq(analysisResults.sessionId, sessionId));
}
