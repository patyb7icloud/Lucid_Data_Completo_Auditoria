import { appRouter as auditoriaRouter } from "./auditoria/api/auditoriaRouter";
import { z } from "zod";
import { nanoid } from "nanoid";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router, stewardProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "./_core/llm";
import * as db from "./db";
import { cache, TTL } from "./cache";
import { triggerWorkflow, recordDecision, cancelWorkflow } from "./workflowEngine";
import {
  exportMeetingMinutesPDF,
  exportMeetingMinutesDOCX,
  exportOrganogramPDF,
  exportMetricsReportPDF,
} from "./exportService";
import {
  getExportHistory,
  countExportHistory,
  getExportHistoryById,
  deleteExportHistory,
  getAllExportHistory,
  getAllUsers,
  updateUserRole,
  countAdmins,
  createRoleAuditLog,
  getRoleAuditLog,
  countRoleAuditLog,
} from "./db";
import {
  queueAndSendEmail,
  buildMeetingInviteEmail,
  buildMeetingReminderEmail,
  buildDecisionEmail,
  buildMeetingSummaryEmail,
  buildMeetingCancelledEmail,
  buildRoleChangeEmail,
  buildTierApprovalEmail,
  buildTierSyncResultEmail,
  verifySmtpConnection,
} from "./emailService";
import {
  createTeamsMeeting,
  getAttendanceReport,
  isTeamsConfigured,
} from "./teamsService";
import {
  getAttendanceByMeeting,
  upsertAttendanceRecord,
  deleteAttendanceByMeeting,
  updateMeetingTeamsInfo,
  getAttendanceRateByPeriod,
} from "./db";
import { parseSqlLineage, parseDbtManifest } from "./lineageParser";
import { mlopsRouter } from "./mlopsRouter";
import { aiRiskRouter } from "./aiRiskRouter";
import { aiPipelineRouter } from "./aiPipelineRouter";
import { biConnectorsRouter } from "./biConnectorsRouter";
import { hubRouter } from "./hubRouter";
import { resolveDatabricksToken } from "./akvResolver";
import { DatabricksAdapter } from "./adapters/DatabricksAdapter";

// ─── Domains Router ───────────────────────────────────────────────────────────
const domainsRouter = router({
  list: publicProcedure.query(() => db.getDomains()),
  byId: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) => db.getDomainById(input.id)),
  create: protectedProcedure.input(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    color: z.string().optional(),
    icon: z.string().optional(),
    status: z.enum(['planejado','em_andamento','concluido','pausado']).optional(),
  })).mutation(({ input }) => db.createDomain(input)),
  update: protectedProcedure.input(z.object({
    id: z.number(),
    name: z.string().optional(),
    description: z.string().optional(),
    color: z.string().optional(),
    icon: z.string().optional(),
    implementationProgress: z.number().min(0).max(100).optional(),
    status: z.enum(['planejado','em_andamento','concluido','pausado']).optional(),
  })).mutation(({ input }) => {
    const { id, ...data } = input;
    return db.updateDomain(id, data);
  }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteDomain(input.id)),
  checkName: publicProcedure.input(z.object({
    name: z.string().min(1),
    excludeId: z.number().optional(),
  })).query(({ input }) => db.checkDomainNameExists(input.name, input.excludeId)),
});

// ─── Participants Router ──────────────────────────────────────────────────────
const participantsRouter = router({
  list: publicProcedure.input(z.object({ domainId: z.number().optional() })).query(({ input }) =>
    db.getParticipants(input.domainId)
  ),
  byId: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) => db.getParticipantById(input.id)),
  create: protectedProcedure.input(z.object({
    name: z.string().min(1),
    email: z.string().email(),
    jobTitle: z.string().optional(),
    department: z.string().optional(),
    phone: z.string().optional(),
    domainId: z.number().optional(),
    role: z.enum(['data_owner','data_steward','product_owner','project_manager','ai_owner','ai_steward','ai_ethics_officer','ml_engineer','model_manager','data_engineer','data_architect','facilitador','representante_negocio','outro']),
    status: z.enum(['ativo','inativo','a_designar']).optional(),
    notes: z.string().optional(),
  })).mutation(({ input }) => db.createParticipant(input)),
  update: protectedProcedure.input(z.object({
    id: z.number(),
    name: z.string().optional(),
    email: z.string().email().optional(),
    jobTitle: z.string().optional(),
    department: z.string().optional(),
    phone: z.string().optional(),
    domainId: z.number().optional(),
    role: z.enum(['data_owner','data_steward','product_owner','project_manager','ai_owner','ai_steward','ai_ethics_officer','ml_engineer','model_manager','data_engineer','data_architect','facilitador','representante_negocio','outro']).optional(),
    status: z.enum(['ativo','inativo','a_designar']).optional(),
    notes: z.string().optional(),
  })).mutation(({ input }) => {
    const { id, ...data } = input;
    return db.updateParticipant(id, data);
  }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteParticipant(input.id)),
  checkEmail: protectedProcedure.input(z.object({
    email: z.string().email(),
    excludeId: z.number().optional(),
  })).query(async ({ input }) => {
    const exists = await db.checkParticipantEmailExists(input.email, input.excludeId);
    return { exists };
  }),
});

// ─── Meetings Router ──────────────────────────────────────────────────────────
const meetingsRouter = router({
  list: publicProcedure.input(z.object({ domainId: z.number().optional() })).query(({ input }) =>
    db.getMeetings(input.domainId)
  ),
  byId: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) => db.getMeetingById(input.id)),
  create: protectedProcedure.input(z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    scheduledAt: z.date(),
    endAt: z.date().optional(),
    location: z.string().optional(),
    meetingLink: z.string().optional(),
    type: z.enum(['ordinaria','extraordinaria','piloto','workshop']).optional(),
    domainId: z.number().optional(),
  })).mutation(({ input }) => db.createMeeting(input)),
  update: protectedProcedure.input(z.object({
    id: z.number(),
    title: z.string().optional(),
    description: z.string().optional(),
    scheduledAt: z.date().optional(),
    endAt: z.date().optional(),
    location: z.string().optional(),
    meetingLink: z.string().optional(),
    status: z.enum(['agendada','realizada','cancelada','adiada']).optional(),
    type: z.enum(['ordinaria','extraordinaria','piloto','workshop']).optional(),
    domainId: z.number().optional(),
    minutesContent: z.string().optional(),
    decisionsContent: z.string().optional(),
    actionsContent: z.string().optional(),
  })).mutation(({ input }) => {
    const { id, ...data } = input;
    return db.updateMeeting(id, data);
  }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteMeeting(input.id)),
  // Agenda Items
  getAgenda: publicProcedure.input(z.object({ meetingId: z.number() })).query(({ input }) =>
    db.getAgendaItems(input.meetingId)
  ),
  addAgendaItem: protectedProcedure.input(z.object({
    meetingId: z.number(),
    title: z.string().min(1),
    description: z.string().optional(),
    duration: z.number().optional(),
    order: z.number().optional(),
    responsibleId: z.number().optional(),
  })).mutation(({ input }) => db.createAgendaItem(input)),
  updateAgendaItem: protectedProcedure.input(z.object({
    id: z.number(),
    title: z.string().optional(),
    description: z.string().optional(),
    duration: z.number().optional(),
    order: z.number().optional(),
    status: z.enum(['pendente','em_andamento','concluido']).optional(),
  })).mutation(({ input }) => {
    const { id, ...data } = input;
    return db.updateAgendaItem(id, data);
  }),
  deleteAgendaItem: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ input }) =>
    db.deleteAgendaItem(input.id)
  ),
  checkConflict: publicProcedure.input(z.object({
    scheduledAt: z.date(),
    endAt: z.date().optional(),
    excludeId: z.number().optional(),
  })).query(({ input }) =>
    db.checkMeetingConflict(input.scheduledAt, input.endAt ?? null, input.excludeId)
  ),
});

// ─── Invites Router ───────────────────────────────────────────────────────────
const invitesRouter = router({
  byMeeting: publicProcedure.input(z.object({ meetingId: z.number() })).query(({ input }) =>
    db.getInvitesByMeeting(input.meetingId)
  ),
  respond: publicProcedure.input(z.object({
    token: z.string(),
    status: z.enum(['confirmado','recusado','talvez']),
    responseNote: z.string().optional(),
  })).mutation(async ({ input }) => {
    return db.updateInviteByToken(input.token, {
      status: input.status,
      responseNote: input.responseNote,
      respondedAt: new Date(),
    });
  }),
  sendInvites: protectedProcedure.input(z.object({
    meetingId: z.number(),
    participantIds: z.array(z.number()),
    origin: z.string(),
  })).mutation(async ({ input }) => {
    const meeting = await db.getMeetingById(input.meetingId);
    if (!meeting) throw new Error("Reunião não encontrada");

    const results = [];
    for (const participantId of input.participantIds) {
      const participant = await db.getParticipantById(participantId);
      if (!participant) continue;
      const token = nanoid(32);
      await db.createInvite({
        meetingId: input.meetingId,
        participantId,
        token,
        status: 'pendente',
        sentAt: new Date(),
      });
      const confirmUrl = `${input.origin}/convite/${token}`;
      results.push({ participantId, token, confirmUrl, email: participant.email });
    }
    await db.updateMeeting(input.meetingId, { invitesSentAt: new Date() });
    return results;
  }),
});

// ─── RACI Router ─────────────────────────────────────────────────────────────
const raciRouter = router({
  list: publicProcedure.input(z.object({ domainId: z.number().optional() })).query(({ input }) =>
    db.getRaciMatrix(input.domainId)
  ),
  create: protectedProcedure.input(z.object({
    activity: z.string().min(1),
    category: z.string().optional(),
    domainId: z.number().optional(),
    dataOwner: z.enum(['R','A','C','I','-']).optional(),
    dataSteward: z.enum(['R','A','C','I','-']).optional(),
    productOwner: z.enum(['R','A','C','I','-']).optional(),
    projectManager: z.enum(['R','A','C','I','-']).optional(),
    aiOwner: z.enum(['R','A','C','I','-']).optional(),
    aiSteward: z.enum(['R','A','C','I','-']).optional(),
    aiEthicsOfficer: z.enum(['R','A','C','I','-']).optional(),
    mlEngineer: z.enum(['R','A','C','I','-']).optional(),
    modelManager: z.enum(['R','A','C','I','-']).optional(),
    notes: z.string().optional(),
  })).mutation(({ input }) => db.createRaciItem(input)),
  update: protectedProcedure.input(z.object({
    id: z.number(),
    activity: z.string().optional(),
    category: z.string().optional(),
    dataOwner: z.enum(['R','A','C','I','-']).optional(),
    dataSteward: z.enum(['R','A','C','I','-']).optional(),
    productOwner: z.enum(['R','A','C','I','-']).optional(),
    projectManager: z.enum(['R','A','C','I','-']).optional(),
    aiOwner: z.enum(['R','A','C','I','-']).optional(),
    aiSteward: z.enum(['R','A','C','I','-']).optional(),
    aiEthicsOfficer: z.enum(['R','A','C','I','-']).optional(),
    mlEngineer: z.enum(['R','A','C','I','-']).optional(),
    modelManager: z.enum(['R','A','C','I','-']).optional(),
    notes: z.string().optional(),
  })).mutation(({ input }) => {
    const { id, ...data } = input;
    return db.updateRaciItem(id, data);
  }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteRaciItem(input.id)),
});

// ─── Implementation Router ────────────────────────────────────────────────────
const implementationRouter = router({
  checklist: publicProcedure.input(z.object({ domainId: z.number() })).query(({ input }) =>
    db.getChecklist(input.domainId)
  ),
  addItem: protectedProcedure.input(z.object({
    domainId: z.number(),
    phase: z.string(),
    title: z.string(),
    description: z.string().optional(),
    order: z.number().optional(),
  })).mutation(({ input }) => db.createChecklistItem(input)),
  toggleItem: protectedProcedure.input(z.object({
    id: z.number(),
    completed: z.boolean(),
    completedBy: z.string().optional(),
  })).mutation(async ({ input }) => {
    return db.updateChecklistItem(input.id, {
      completed: input.completed,
      completedAt: input.completed ? new Date() : undefined,
      completedBy: input.completedBy,
    });
  }),
  updateProgress: protectedProcedure.input(z.object({
    domainId: z.number(),
    progress: z.number().min(0).max(100),
    status: z.enum(['planejado','em_andamento','concluido','pausado']).optional(),
  })).mutation(({ input }) => {
    return db.updateDomain(input.domainId, {
      implementationProgress: input.progress,
      status: input.status,
    });
  }),
});

// ─── AI Assistant Router ──────────────────────────────────────────────────────
const aiRouter = router({
  chat: protectedProcedure.input(z.object({
    sessionId: z.string(),
    message: z.string().min(1),
    context: z.object({
      domainId: z.number().optional(),
      participantCount: z.number().optional(),
      currentPhase: z.string().optional(),
    }).optional(),
  })).mutation(async ({ input, ctx }) => {
    const history = await db.getAiChatHistory(input.sessionId);
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      {
        role: 'system',
        content: `Você é o Co-Piloto de Governança de Dados da Lucid Data Governance.
Sua função é auxiliar na gestão do Portal de Governança, fornecendo:
- Sugestões de classificação de sensibilidade (Público, Interno, Confidencial, Restrito) para novos ativos de dados.
- Auxílio na definição de termos do Dicionário de Dados e regras de negócio.
- Análise de linhagem para identificar impactos de mudanças em sistemas (ex: SAP, Snowflake).
- Recomendações sobre estrutura de papéis (Data Owner, Steward, etc.).
- Orientações sobre conformidade LGPD e segurança de dados.
- Explicações sobre métricas de qualidade de dados (completude, acurácia).

Ao sugerir metadados, leve em conta o contexto industrial da Lucid Data Governance.
Responda sempre em português brasileiro, de forma executiva, profissional e orientada a dados.
Contexto atual: ${JSON.stringify(input.context || {})}`,
      },
    ];

    for (const msg of history.slice(-10)) {
      messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
    }
    messages.push({ role: 'user', content: input.message });

    await db.saveAiMessage({
      sessionId: input.sessionId,
      userId: ctx.user.id,
      role: 'user',
      content: input.message,
      context: input.context,
    });

    const response = await invokeLLM({ messages });
    const rawContent = response.choices[0]?.message?.content;
    const assistantMessage = typeof rawContent === 'string' ? rawContent : "Desculpe, não consegui processar sua solicitação.";

    await db.saveAiMessage({
      sessionId: input.sessionId,
      userId: ctx.user.id,
      role: 'assistant',
      content: assistantMessage,
    });

    return { message: assistantMessage };
  }),
  history: protectedProcedure.input(z.object({ sessionId: z.string() })).query(({ input }) =>
    db.getAiChatHistory(input.sessionId)
  ),
});

// ─── ServiceNow Router ────────────────────────────────────────────────────────
const servicenowRouter = router({
  getTickets: publicProcedure.input(z.object({ domainId: z.number().optional() })).query(({ input }) =>
    db.getServiceNowTickets({ domainId: input.domainId })
  ),
  list: publicProcedure.input(z.object({ domainId: z.number().optional() })).query(({ input }) =>
    db.getServicenowTickets(input.domainId)
  ),
  create: protectedProcedure.input(z.object({
    ticketNumber: z.string(),
    title: z.string(),
    description: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    assignedTo: z.string().optional(),
    domainId: z.number().optional(),
    participantId: z.number().optional(),
    meetingId: z.number().optional(),
    externalUrl: z.string().optional(),
  })).mutation(({ input }) => db.createServicenowTicket(input)),
  update: protectedProcedure.input(z.object({
    id: z.number(),
    status: z.string().optional(),
    priority: z.string().optional(),
    assignedTo: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
  })).mutation(({ input }) => {
    const { id, ...data } = input;
    return db.updateServicenowTicket(id, { ...data, syncedAt: new Date() });
  }),
});

// ─── Notifications Router ────────────────────────────────────────────────────
const notificationsRouter = router({
  list: protectedProcedure
    .input(z.object({
      limit: z.number().default(50),
      offset: z.number().default(0),
      status: z.enum(["pendente", "enviado", "falhou", "cancelado"]).optional(),
    }))
    .query(({ input }) => db.getEmailNotifications(input)),

  verifySmtp: protectedProcedure.query(() => verifySmtpConnection()),

  getPreferences: protectedProcedure
    .input(z.object({ participantId: z.number() }))
    .query(({ input }) => db.getNotificationPreferences(input.participantId)),

  savePreferences: protectedProcedure
    .input(z.object({
      participantId: z.number(),
      meetingInvite: z.boolean().optional(),
      meetingReminder: z.boolean().optional(),
      meetingCancelled: z.boolean().optional(),
      decisionRegistered: z.boolean().optional(),
      meetingSummary: z.boolean().optional(),
      domainUpdate: z.boolean().optional(),
      reminderHoursBefore: z.number().optional(),
    }))
    .mutation(({ input }) => db.upsertNotificationPreferences(input)),

  sendMeetingInvites: protectedProcedure
    .input(z.object({ meetingId: z.number(), origin: z.string() }))
    .mutation(async ({ input }) => {
      const meeting = await db.getMeetingById(input.meetingId);
      if (!meeting) throw new Error("Reunião não encontrada");
      const invites = await db.getInvitesByMeeting(input.meetingId);
      const agendaItems = await db.getAgendaItems(input.meetingId);
      const agenda = agendaItems.map((a: { title: string }) => a.title);
      const results: Array<{ email: string; success: boolean; error?: string }> = [];
      for (const invite of invites) {
        const prefs = invite.participantId ? await db.getNotificationPreferences(invite.participantId) : null;
        if (prefs && prefs.meetingInvite === false) continue;
        const meetingDate = meeting.scheduledAt
          ? new Date(meeting.scheduledAt).toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
          : "A definir";
        const meetingTime = meeting.scheduledAt
          ? new Date(meeting.scheduledAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
          : "A definir";
        const confirmUrl = `${input.origin}/convite/${invite.token}?action=confirm`;
        const declineUrl = `${input.origin}/convite/${invite.token}?action=decline`;
        const { subject, html } = buildMeetingInviteEmail({
          recipientName: invite.participantName ?? "Participante",
          meetingTitle: meeting.title,
          meetingDate,
          meetingTime,
          location: meeting.location ?? "A definir",
          agenda,
          confirmUrl,
          declineUrl,
          organizer: "Lucid Data Governance",
        });
        const result = await queueAndSendEmail({
          type: "meeting_invite",
          recipientEmail: invite.email ?? "",
          recipientName: invite.participantName ?? undefined,
          subject,
          html,
          meetingId: input.meetingId,
          inviteId: invite.id,
        });
        results.push({ email: invite.email ?? "", success: result.success, error: result.error });
      }
      return { sent: results.filter((r) => r.success).length, failed: results.filter((r) => !r.success).length, results };
    }),

  sendMeetingReminder: protectedProcedure
    .input(z.object({ meetingId: z.number() }))
    .mutation(async ({ input }) => {
      const meeting = await db.getMeetingById(input.meetingId);
      if (!meeting) throw new Error("Reunião não encontrada");
      const invites = await db.getInvitesByMeeting(input.meetingId);
      const results: Array<{ email: string; success: boolean }> = [];
      const meetingDate = meeting.scheduledAt
        ? new Date(meeting.scheduledAt).toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
        : "A definir";
      const meetingTime = meeting.scheduledAt
        ? new Date(meeting.scheduledAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        : "A definir";
      const now = new Date();
      const scheduledAt = meeting.scheduledAt ? new Date(meeting.scheduledAt) : now;
      const hoursUntil = Math.max(Math.round((scheduledAt.getTime() - now.getTime()) / (1000 * 60 * 60)), 1);
      for (const invite of invites) {
        if ((invite.status ?? "") !== "confirmado") continue;
        const prefs = invite.participantId ? await db.getNotificationPreferences(invite.participantId) : null;
        if (prefs && prefs.meetingReminder === false) continue;
        const { subject, html } = buildMeetingReminderEmail({
          recipientName: invite.participantName ?? "Participante",
          meetingTitle: meeting.title,
          meetingDate,
          meetingTime,
          location: meeting.location ?? "A definir",
          hoursUntil,
        });
        const result = await queueAndSendEmail({
          type: "meeting_reminder",
          recipientEmail: invite.email ?? "",
          recipientName: invite.participantName ?? undefined,
          subject,
          html,
          meetingId: input.meetingId,
        });
        results.push({ email: invite.email ?? "", success: result.success });
      }
      return { sent: results.filter((r) => r.success).length, results };
    }),

  sendDecisionNotification: protectedProcedure
    .input(z.object({
      meetingId: z.number(),
      decisions: z.array(z.object({
        title: z.string(),
        description: z.string(),
        responsible: z.string().optional(),
        deadline: z.string().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const meeting = await db.getMeetingById(input.meetingId);
      if (!meeting) throw new Error("Reunião não encontrada");
      const invites = await db.getInvitesByMeeting(input.meetingId);
      const meetingDate = meeting.scheduledAt ? new Date(meeting.scheduledAt).toLocaleDateString("pt-BR") : "A definir";
      const results: Array<{ email: string; success: boolean }> = [];
      for (const invite of invites) {
        const prefs = invite.participantId ? await db.getNotificationPreferences(invite.participantId) : null;
        if (prefs && prefs.decisionRegistered === false) continue;
        const { subject, html } = buildDecisionEmail({
          recipientName: invite.participantName ?? "Participante",
          meetingTitle: meeting.title,
          meetingDate,
          decisions: input.decisions,
        });
        const result = await queueAndSendEmail({
          type: "decision_registered",
          recipientEmail: invite.email ?? "",
          recipientName: invite.participantName ?? undefined,
          subject,
          html,
          meetingId: input.meetingId,
        });
        results.push({ email: invite.email ?? "", success: result.success });
      }
      return { sent: results.filter((r) => r.success).length, results };
    }),

  sendMeetingSummary: protectedProcedure
    .input(z.object({
      meetingId: z.number(),
      decisions: z.array(z.string()),
      nextSteps: z.array(z.string()),
      nextMeetingDate: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const meeting = await db.getMeetingById(input.meetingId);
      if (!meeting) throw new Error("Reunião não encontrada");
      const invites = await db.getInvitesByMeeting(input.meetingId);
      const attendees = invites.filter((i: { status?: string | null }) => (i.status ?? "") === "confirmado").map((i: { participantName?: string | null }) => i.participantName ?? "Participante");
      const meetingDate = meeting.scheduledAt ? new Date(meeting.scheduledAt).toLocaleDateString("pt-BR") : "A definir";
      const results: Array<{ email: string; success: boolean }> = [];
      for (const invite of invites) {
        const prefs = invite.participantId ? await db.getNotificationPreferences(invite.participantId) : null;
        if (prefs && prefs.meetingSummary === false) continue;
        const summaryUrl = `${process.env.PUBLIC_URL ?? "http://localhost:3000"}/reunioes/${input.meetingId}`;
        const { subject, html } = buildMeetingSummaryEmail({
          recipientName: invite.participantName ?? "Participante",
          meetingTitle: meeting.title,
          meetingDate,
          attendees,
          decisions: input.decisions,
          nextSteps: input.nextSteps,
          nextMeetingDate: input.nextMeetingDate,
          summaryUrl,
        });
        const result = await queueAndSendEmail({
          type: "meeting_summary",
          recipientEmail: invite.email ?? "",
          recipientName: invite.participantName ?? undefined,
          subject,
          html,
          meetingId: input.meetingId,
        });
        results.push({ email: invite.email ?? "", success: result.success });
      }
      return { sent: results.filter((r) => r.success).length, results };
    }),

  sendCancellationNotice: protectedProcedure
    .input(z.object({ meetingId: z.number(), reason: z.string().optional() }))
    .mutation(async ({ input }) => {
      const meeting = await db.getMeetingById(input.meetingId);
      if (!meeting) throw new Error("Reunião não encontrada");
      const invites = await db.getInvitesByMeeting(input.meetingId);
      const meetingDate = meeting.scheduledAt ? new Date(meeting.scheduledAt).toLocaleDateString("pt-BR") : "A definir";
      const results: Array<{ email: string; success: boolean }> = [];
      for (const invite of invites) {
        const prefs = invite.participantId ? await db.getNotificationPreferences(invite.participantId) : null;
        if (prefs && prefs.meetingCancelled === false) continue;
        const { subject, html } = buildMeetingCancelledEmail({
          recipientName: invite.participantName ?? "Participante",
          meetingTitle: meeting.title,
          meetingDate,
          reason: input.reason,
        });
        const result = await queueAndSendEmail({
          type: "meeting_cancelled",
          recipientEmail: invite.email ?? "",
          recipientName: invite.participantName ?? undefined,
          subject,
          html,
          meetingId: input.meetingId,
        });
        results.push({ email: invite.email ?? "", success: result.success });
      }
      return { sent: results.filter((r) => r.success).length, results };
    }),

  sendCustomEmail: protectedProcedure
    .input(z.object({
      recipientEmails: z.array(z.string().email()),
      subject: z.string().min(1),
      message: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const results: Array<{ email: string; success: boolean }> = [];
      for (const email of input.recipientEmails) {
        const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;padding:32px;background:#F4F6FA;"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;"><div style="background:#1B3A8C;padding:24px 32px;"><h2 style="color:#fff;margin:0;">Lucid Data Governance</h2><div style="color:#6DC23A;font-size:12px;margin-top:4px;">COMUNICADO</div></div><div style="padding:32px;"><p style="color:#2D3748;font-size:15px;line-height:1.6;">${input.message.replace(/\n/g, "<br/>")}</p></div><div style="background:#1B3A8C;padding:16px 32px;text-align:center;"><p style="color:#A0AEC0;font-size:12px;margin:0;">© ${new Date().getFullYear()} Lucid Data Governance — Governança de Dados & IA</p></div></div></body></html>`;
        const result = await queueAndSendEmail({ type: "custom", recipientEmail: email, subject: input.subject, html });
        results.push({ email, success: result.success });
      }
      return { sent: results.filter((r) => r.success).length, results };
    }),
});

// ─── Export Router ──────────────────────────────────────────────────────────
const exportRouter = router({
  meetingMinutesPDF: protectedProcedure
    .input(z.object({ meetingId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const exportCtx = { generatedBy: ctx.user?.name ?? undefined, generatedById: ctx.user?.id ?? undefined };
      const url = await exportMeetingMinutesPDF(input.meetingId, exportCtx);
      return { url, filename: `ata-reuniao-${input.meetingId}.pdf` };
    }),

  meetingMinutesDOCX: protectedProcedure
    .input(z.object({ meetingId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const exportCtx = { generatedBy: ctx.user?.name ?? undefined, generatedById: ctx.user?.id ?? undefined };
      const url = await exportMeetingMinutesDOCX(input.meetingId, exportCtx);
      return { url, filename: `ata-reuniao-${input.meetingId}.docx` };
    }),

  organogramPDF: protectedProcedure
    .input(z.object({ domainId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const exportCtx = { generatedBy: ctx.user?.name ?? undefined, generatedById: ctx.user?.id ?? undefined };
      const url = await exportOrganogramPDF(input.domainId, exportCtx);
      return { url, filename: `organograma-dominio-${input.domainId}.pdf` };
    }),

  metricsReportPDF: protectedProcedure
    .mutation(async ({ ctx }) => {
      const exportCtx = { generatedBy: ctx.user?.name ?? undefined, generatedById: ctx.user?.id ?? undefined };
      const url = await exportMetricsReportPDF(exportCtx);
      return { url, filename: `relatorio-metricas-lucid-data-governance.pdf` };
    }),

  // ─ Histórico de Exportações
  history: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
      documentType: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const isAdmin = ctx.user?.role === "admin";
      const ownerFilter = isAdmin ? undefined : (ctx.user?.openId ?? "");
      const [items, total] = await Promise.all([
        getExportHistory({ limit: input.limit, offset: input.offset, documentType: input.documentType, generatedBy: ownerFilter }),
        countExportHistory({ documentType: input.documentType, generatedBy: ownerFilter }),
      ]);
      return { items, total, limit: input.limit, offset: input.offset, isAdmin };
    }),

  historyById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const record = await getExportHistoryById(input.id);
      if (!record) return null;
      const isAdmin = ctx.user?.role === "admin";
      // Usuário comum só acessa o próprio registro
      if (!isAdmin && record.generatedById !== ctx.user?.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado a este registro." });
      }
      return record;
    }),

  deleteHistory: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const record = await getExportHistoryById(input.id);
      if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Registro não encontrado." });
      const isAdmin = ctx.user?.role === "admin";
      if (!isAdmin && record.generatedById !== ctx.user?.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode remover o registro de outro usuário." });
      }
      return deleteExportHistory(input.id);
    }),

  historyExport: protectedProcedure
    .input(z.object({
      documentType: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const isAdmin = ctx.user?.role === "admin";
      const ownerFilter = isAdmin ? undefined : (ctx.user?.openId ?? "");
      const items = await getAllExportHistory({ documentType: input.documentType, generatedBy: ownerFilter });
      return items.map((item) => ({
        id: item.id,
        documentTitle: item.documentTitle,
        documentType: item.documentType,
        fileFormat: item.fileFormat,
        filename: item.filename,
        fileUrl: item.fileUrl,
        generatedBy: item.generatedBy ?? "",
        referenceName: item.referenceName ?? "",
        fileSizeBytes: item.fileSizeBytes ?? 0,
        createdAt: item.createdAt,
      }));
    }),
});

// ─── Roles Router ────────────────────────────────────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user?.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
  }
  return next({ ctx });
});

const rolesRouter = router({
  listUsers: adminProcedure
    .input(z.object({
      search: z.string().optional(),
      role: z.enum(["user", "admin", "data_steward", "data_owner", "data_analyst"]).optional(),
    }))
    .query(async ({ input }) => db.getUnifiedMembers({ search: input.search, role: input.role as any })),

  enableAccess: adminProcedure
    .input(z.object({
      participantId: z.number(),
      role: z.enum(["user", "admin", "data_steward", "data_owner", "data_analyst"]),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const participant = await db.getParticipantById(input.participantId);
      if (!participant) throw new TRPCError({ code: "NOT_FOUND", message: "Participante não encontrado." });

      // ── Quota enforcement: verificar limite de usuários da organização ─────
      const orgId = ctx.user?.organizationId ?? 1;
      const org = await db.getOrganizationById(orgId);
      if (org?.maxUsers) {
        const usage = await db.getOrganizationUsage(orgId);
        if (usage.userCount >= org.maxUsers) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Limite do plano atingido: sua organização já possui ${usage.userCount} usuário(s) ativo(s) (máximo: ${org.maxUsers}). Faça upgrade do plano para continuar.`,
          });
        }
      }
      // ─────────────────────────────────────────────────────────────────────────

      const openId = `vc_${participant.id}_${nanoid(6)}`;
      
      // 1. Criar Usuário
      await db.upsertUser({
        openId,
        name: participant.name,
        email: participant.email,
        role: input.role as any,
        lastSignedIn: new Date(),
      });

      const newUser = await db.getUserByOpenId(openId);
      if (!newUser) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao criar usuário." });

      // 2. Vincular ao Participante
      await db.updateParticipant(participant.id, { userId: newUser.id });

      // 3. Auditoria
      await db.createRoleAuditLog({
        executorOpenId: ctx.user!.openId,
        executorName: ctx.user!.name ?? undefined,
        targetOpenId: openId,
        targetName: participant.name,
        targetEmail: participant.email,
        previousRole: "none",
        newRole: input.role,
        reason: input.reason || "Primeiro acesso habilitado.",
      });

      return { success: true, openId };
    }),

  disableAccess: adminProcedure
    .input(z.object({
      participantId: z.number(),
      reason: z.string().min(5, "O motivo deve ter pelo menos 5 caracteres."),
    }))
    .mutation(async ({ input, ctx }) => {
      const participant = await db.getParticipantById(input.participantId);
      if (!participant || !participant.userId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Participante sem acesso vinculado." });
      }

      const allUsers = await db.getAllUsers();
      const targetUser = allUsers.find(u => u.id === participant.userId);
      if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });

      if (targetUser.openId === ctx.user?.openId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode revogar o seu próprio acesso." });
      }

      if (targetUser.role === "admin") {
        const adminCount = await db.countAdmins();
        if (adminCount <= 1) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Não é possível revogar o acesso do único administrador." });
        }
      }

      // 1. Auditoria
      await db.createRoleAuditLog({
        executorOpenId: ctx.user!.openId,
        executorName: ctx.user!.name ?? undefined,
        targetOpenId: targetUser.openId,
        targetName: participant.name,
        targetEmail: participant.email,
        previousRole: targetUser.role as any,
        newRole: "revoked",
        reason: input.reason,
      });

      // 2. Deletar Usuário e Limpar Vínculo
      await db.deleteUser(targetUser.openId);
      await db.updateParticipant(participant.id, { userId: null });

      return { success: true };
    }),

  updateRole: adminProcedure
    .input(z.object({
      targetOpenId: z.string(),
      newRole: z.enum(["user", "admin", "data_steward", "data_owner", "data_analyst"]),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (input.targetOpenId === ctx.user?.openId && input.newRole !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode rebaixar a si mesmo." });
      }
      if (input.newRole === "user") {
        const adminCount = await db.countAdmins();
        if (adminCount <= 1) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Não é possível rebaixar o único administrador do sistema." });
        }
      }
      const allUsers = await db.getAllUsers();
      const targetUser = allUsers.find(u => u.openId === input.targetOpenId);
      const previousRole = targetUser?.role ?? "user";
      const updated = await updateUserRole(input.targetOpenId, input.newRole);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
      await db.createRoleAuditLog({
        executorOpenId: ctx.user!.openId,
        executorName: ctx.user!.name ?? undefined,
        targetOpenId: input.targetOpenId,
        targetName: targetUser?.name ?? undefined,
        targetEmail: targetUser?.email ?? undefined,
        previousRole: previousRole,
        newRole: input.newRole,
        reason: input.reason || "Alteração de papel via painel administrativo.",
      });
      if (targetUser?.email) {
        type AppRole = "user" | "admin" | "data_steward" | "data_owner" | "data_analyst";
        const { subject, html } = buildRoleChangeEmail({
          targetName: targetUser.name ?? targetUser.email,
          executorName: ctx.user!.name ?? ctx.user!.openId,
          previousRole: previousRole as AppRole,
          newRole: input.newRole as AppRole,
          changedAt: new Date(),
        });
        queueAndSendEmail({
          type: "custom",
          recipientEmail: targetUser.email,
          recipientName: targetUser.name ?? undefined,
          subject,
          html,
          metadata: { action: "role_change", previousRole, newRole: input.newRole },
        }).catch((err) => console.error("[RoleChange Email] Failed:", err));
      }
      return updated;
    }),

  stats: adminProcedure.query(async () => {
    const [all, admins] = await Promise.all([getAllUsers(), countAdmins()]);
    return { total: all.length, admins, users: all.length - admins };
  }),

  auditLog: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
      action: z.enum(["promoted", "demoted"]).optional(),
      search: z.string().optional(),
      dateFrom: z.date().optional(),
      dateTo: z.date().optional(),
    }))
    .query(async ({ input }) => {
      const [entries, total] = await Promise.all([
        getRoleAuditLog({
          limit: input.limit,
          offset: input.offset,
          action: input.action,
          search: input.search,
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
        }),
        countRoleAuditLog({
          action: input.action,
          search: input.search,
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
        }),
      ]);
      return { entries, total };
    }),
});

// ─── Teams Router ──────────────────────────────────────────────────────────────────────────
const teamsRouter = router({
  isConfigured: publicProcedure.query(() => isTeamsConfigured()),
  createMeeting: protectedProcedure
    .input(z.object({ meetingId: z.number() }))
    .mutation(async ({ input }) => {
      if (!isTeamsConfigured()) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Credenciais do Microsoft Teams não configuradas.' });
      }
      const meeting = await db.getMeetingById(input.meetingId);
      if (!meeting) throw new TRPCError({ code: 'NOT_FOUND', message: 'Reunião não encontrada.' });
      const endAt = meeting.endAt ?? new Date(meeting.scheduledAt.getTime() + 60 * 60 * 1000);
      const result = await createTeamsMeeting(meeting.title, meeting.scheduledAt, endAt);
      if (!result) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao criar reunião no Teams.' });
      await updateMeetingTeamsInfo(input.meetingId, {
        teamsMeetingId: result.teamsMeetingId,
        teamsJoinUrl: result.teamsJoinUrl,
      });
      return result;
    }),
  syncAttendance: protectedProcedure
    .input(z.object({ meetingId: z.number() }))
    .mutation(async ({ input }) => {
      const meeting = await db.getMeetingById(input.meetingId);
      if (!meeting) throw new TRPCError({ code: 'NOT_FOUND', message: 'Reunião não encontrada.' });
      if (!meeting.teamsMeetingId) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Esta reunião não está vinculada ao Teams.' });
      }
      const records = await getAttendanceReport(meeting.teamsMeetingId);
      if (records.length === 0) return { synced: 0, message: 'Nenhum registro de presença disponível.' };
      await deleteAttendanceByMeeting(input.meetingId);
      for (const rec of records) {
        await upsertAttendanceRecord({
          meetingId: input.meetingId,
          participantName: rec.participantName,
          participantEmail: rec.participantEmail,
          joinedAt: rec.joinedAt ?? undefined,
          leftAt: rec.leftAt ?? undefined,
          durationMinutes: rec.durationMinutes,
          attended: rec.attended,
          source: 'teams',
        });
      }
      await updateMeetingTeamsInfo(input.meetingId, { teamsAttendanceSyncedAt: new Date() });
      return { synced: records.length, message: `${records.length} registro(s) sincronizado(s).` };
    }),
  attendance: protectedProcedure
    .input(z.object({ meetingId: z.number() }))
    .query(async ({ input }) => db.getAttendanceByMeeting(input.meetingId)),
  attendanceRate: protectedProcedure
    .input(z.object({ months: z.number().min(1).max(24).default(6) }))
    .query(async ({ input }) => getAttendanceRateByPeriod(input.months)),
});

// ─── Metrics Router
const metricsRouter = router({
  dashboard: publicProcedure.query(() => db.getDashboardMetrics()),
  meetingsByMonth: publicProcedure
    .input(z.object({ months: z.number().min(1).max(24).optional() }))
    .query(({ input }) => db.getMeetingsByMonth(input.months ?? 6)),
});

// ─── Ticket Alert Configs Router ────────────────────────────────────────────
import { runTicketAlertCheck } from "./ticketAlertScheduler";
const ticketAlertConfigsRouter = router({
  list: protectedProcedure.query(() => db.getTicketAlertConfigs()),
  byDomain: protectedProcedure
    .input(z.object({ domainId: z.number() }))
    .query(({ input }) => db.getTicketAlertConfigByDomain(input.domainId)),
  upsert: protectedProcedure
    .input(z.object({
      domainId: z.number(),
      criticalDays: z.number().int().min(1).max(365).default(3),
      highDays: z.number().int().min(1).max(365).default(7),
      enabled: z.number().int().min(0).max(1).default(1),
    }))
    .mutation(async ({ input }) => {
      await db.upsertTicketAlertConfig(input);
      return { success: true };
    }),
  runNow: protectedProcedure
    .use(({ ctx, next }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return next({ ctx });
    })
    .mutation(async () => runTicketAlertCheck()),
});

// ─── Settings Router ──────────────────────────────────────────────────────────
const settingsRouter = router({
  get: protectedProcedure.input(z.object({ key: z.string() })).query(({ input }) => db.getSystemSetting(input.key)),
  list: protectedProcedure.query(() => db.getSystemSettings()),
  set: protectedProcedure.input(z.object({
    key: z.string(),
    value: z.string().nullable(),
    description: z.string().optional(),
  })).mutation(({ input, ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    return db.setSystemSetting(input.key, input.value, input.description);
  }),
});

// ─── Feedback Router ──────────────────────────────────────────────────────────
const feedbackRouter = router({
  submit: protectedProcedure
    .input(z.object({
      type: z.enum(["sugestao", "bug", "elogio", "outro"]),
      message: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await db.createFeedback({
        userId: ctx.user.id,
        type: input.type,
        message: input.message,
        status: "novo",
      });
      return { success: true };
    }),

  list: adminProcedure
    .input(z.object({
      limit: z.number().optional(),
      offset: z.number().optional(),
      status: z.string().optional(),
      type: z.string().optional(),
      userId: z.number().optional(),
    }))
    .query(({ input }) => db.getFeedbacks(input)),

  myFeedbacks: protectedProcedure
    .query(({ ctx }) => db.getFeedbacks({ userId: ctx.user.id })),

  updateStatus: adminProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["novo", "em_analise", "concluido"]),
    }))
    .mutation(async ({ input }) => {
      await db.updateFeedbackStatus(input.id, input.status);
      return { success: true };
    }),
});

// ─── Governance Router ────────────────────────────────────────────────────────
const governanceRouter = router({
  // Ativos de Dados
  listAssets: publicProcedure.input(z.object({
    domainId: z.number().optional(),
    search: z.string().optional(),
    sensitivity: z.string().optional(),
    criticality: z.string().optional(),
    type: z.string().optional(),
    limit: z.number().optional().default(100),
    offset: z.number().optional().default(0),
    organizationId: z.number().optional(),
  })).query(async ({ input, ctx }) => {
    // Multi-tenancy enforcement: if user is not admin and has an org, force filter
    const effectiveOrgId = (ctx.user?.role !== 'admin' && ctx.user?.organizationId) 
      ? ctx.user.organizationId 
      : input.organizationId;

    const params = { ...input, organizationId: effectiveOrgId };

    // Chave de cache determinística baseada nos parâmetros
    const cacheKey = `assets:${JSON.stringify(params)}`;

    // Busca semântica TF-IDF: re-ranqueia resultados por relevância
    if (input.search?.trim()) {
      return db.semanticSearchAssets(input.search, {
        organizationId: effectiveOrgId,
        sensitivity: input.sensitivity,
        type: input.type,
        limit: input.limit,
      });
    }

    return cache.wrap(cacheKey, () => db.getDataAssets(params), TTL.MEDIUM);
  }),
  assetById: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) =>
    db.getDataAssetById(input.id)
  ),
  createAsset: protectedProcedure.input(z.object({
    name: z.string().min(1),
    type: z.enum(['tabela', 'api', 'arquivo', 'dashboard', 'outro']),
    description: z.string().optional(),
    domainId: z.number().optional(),
    sourceSystem: z.string().optional(),
    sensitivity: z.enum(['publico', 'interno', 'confidencial', 'restrito']).optional(),
    ownerId: z.number().optional(),
    stewardId: z.number().optional(),
  })).mutation(async ({ input, ctx }) => {
    // ── Quota enforcement: verificar limite de ativos da organização ──────────
    const orgId = ctx.user?.organizationId ?? 1;
    const org = await db.getOrganizationById(orgId);
    if (org?.maxAssets) {
      const usage = await db.getOrganizationUsage(orgId);
      if (usage.assetCount >= org.maxAssets) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Limite do plano atingido: sua organização já possui ${usage.assetCount} ativo(s) de dados (máximo: ${org.maxAssets}). Faça upgrade do plano para continuar.`,
        });
      }
    }
    // ─────────────────────────────────────────────────────────────────────────
    const result = await db.createDataAsset(input);
    await cache.flush("assets:"); // Invalida cache de listagem
    await db.createAuditLog({
      userId: ctx.user?.id, userEmail: ctx.user?.email, userName: ctx.user?.name,
      action: "create", entity: "data_asset", entityName: input.name,
      details: { type: input.type, sensitivity: input.sensitivity },
      ipAddress: ctx.req?.ip,
    });
    db.dispatchWebhook("asset.created", {
      id: (result as any).insertId ?? null,
      name: input.name,
      type: input.type,
      sensitivity: input.sensitivity,
      createdBy: ctx.user?.email,
    }).catch(() => {});
    return result;
  }),

  updateAsset: protectedProcedure.input(z.object({
    id: z.number(),
    name: z.string().min(1).optional(),
    type: z.enum(['tabela', 'api', 'arquivo', 'dashboard', 'outro']).optional(),
    description: z.string().optional(),
    domainId: z.number().nullable().optional(),
    sourceSystem: z.string().optional(),
    sensitivity: z.enum(['publico', 'interno', 'confidencial', 'restrito']).optional(),
    criticality: z.enum(['baixa', 'media', 'alta', 'critica']).optional(),
    status: z.enum(['ativo', 'inativo', 'deprecated']).optional(),
    ownerId: z.number().nullable().optional(),
    stewardId: z.number().nullable().optional(),
    businessArea: z.string().optional(),
    region: z.string().optional(),
    fullyQualifiedName: z.string().optional(),
    businessValueScore: z.number().min(0).max(100).optional(),
  })).mutation(async ({ input, ctx }) => {
    const { id, ...data } = input;

    // Data Contract Enforcement (Breaking Change protection)
    if (data.name) {
      const activeContracts = await db.getDataContracts({ assetId: id, status: 'ativo' });
      if (activeContracts.length > 0) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `Não é possível renomear o ativo pois existem ${activeContracts.length} contratos vigentes. Desative os contratos ou atualize-os primeiro para evitar quebra em consumidores.`
        });
      }
    }

    const result = await db.updateDataAsset(id, data as any);
    await cache.flush("assets:"); // Invalida cache de listagem para ver refletido imediatamente
    await db.createAuditLog({
      userId: ctx.user?.id, userEmail: ctx.user?.email, userName: ctx.user?.name,
      action: "update", entity: "data_asset", entityId: id,
      details: data,
      ipAddress: ctx.req?.ip,
    });
    return result;
  }),
  
  // Dicionário de Dados
  getAttributes: publicProcedure.input(z.object({ assetId: z.number() })).query(async ({ input, ctx }) => {
    const attrs = await db.getDataAttributes(input.assetId);
    
    // PII Masking: se o usuário não for admin ou steward, mascare valores sensíveis
    const canSeePii = ctx.user && (ctx.user.role === 'admin' || ctx.user.role === 'data_steward');
    
    return attrs.map(attr => {
      if (attr.isPii && !canSeePii && attr.sampleValue) {
        return {
          ...attr,
          sampleValue: "******** (Conteúdo Sensível)"
        };
      }
      return attr;
    });
  }),

  // PII Scanner: escaneia atributos de um ativo e retorna detecções de PII
  scanPii: protectedProcedure.input(z.object({ assetId: z.number() })).mutation(async ({ input }) => {
    const { scanTableForPii } = await import("./piiScanner");
    const attrs = await db.getDataAttributes(input.assetId);
    const results = attrs.map(attr => ({
      attrId: attr.id,
      name: attr.name,
      dataType: attr.dataType,
      ...scanTableForPii(attr.name, attr.dataType ?? ""),
    }));
    // Atualizar isPii automaticamente para os detectados
    await Promise.all(
      results
        .filter(r => r.isPii && !r.isPii === false)
        .map(r => db.updateDataAttribute(r.attrId, { isPii: true } as any).catch(() => null))
    );
    return {
      total: results.length,
      piiDetected: results.filter(r => r.isPii).length,
      results,
    };
  }),
  addAttribute: protectedProcedure.input(z.object({
    assetId: z.number(),
    name: z.string().min(1),
    dataType: z.string().optional(),
    description: z.string().optional(),
    businessRules: z.string().optional(),
    isPii: z.boolean().optional(),
    isKey: z.boolean().optional(),
  })).mutation(({ input }) => db.createDataAttribute(input)),

  updateAttribute: protectedProcedure.input(z.object({
    id: z.number(),
    description: z.string().optional(),
    businessRules: z.string().optional(),
    isPii: z.boolean().optional(),
    isVerified: z.boolean().optional(),
    verifiedBy: z.string().optional(),
    verifiedAt: z.date().optional(),
    aiSuggestion: z.string().optional(),
  })).mutation(({ input }) => db.updateDataAttribute(input.id, {
    ...input,
    verifiedAt: input.verifiedAt || (input.isVerified ? new Date() : undefined)
  })),

  // Linhagem de Dados
  getLineage: publicProcedure.input(z.object({ assetId: z.number() })).query(({ input }) =>
    db.getDataLineage(input.assetId)
  ),
  getAllLineage: publicProcedure.query(() => db.getAllDataLineage()),

  /** Parseia SQL e importa lineagem detectada automaticamente */
  importFromSql: protectedProcedure.input(z.object({
    sqlContent: z.string().min(10),
  })).mutation(async ({ input }) => {
    const edges = parseSqlLineage(input.sqlContent);
    if (edges.length === 0) return { imported: 0, skipped: 0, detectedEdges: 0 };
    const result = await db.importLineageEdges(edges);
    return { ...result, detectedEdges: edges.length };
  }),

  /** Parseia manifest.json do dbt e importa lineagem dos modelos */
  importFromDbt: protectedProcedure.input(z.object({
    manifestJson: z.string().min(10),
  })).mutation(async ({ input }) => {
    const edges = parseDbtManifest(input.manifestJson);
    if (edges.length === 0) return { imported: 0, skipped: 0, detectedEdges: 0 };
    const result = await db.importLineageEdges(edges);
    return { ...result, detectedEdges: edges.length };
  }),
  
  // Qualidade de Dados
  getQuality: publicProcedure.input(z.object({ assetId: z.number() })).query(({ input }) =>
    db.getDataQualityChecks(input.assetId)
  ),
  getQualityHistory: publicProcedure.input(z.object({ assetId: z.number(), days: z.number().optional().default(30) })).query(({ input }) =>
    db.getDataQualityHistory(input.assetId, input.days)
  ),
  getGlobalQualityDimensions: publicProcedure.query(() =>
    db.getGlobalQualityDimensions()
  ),
  tagAttributesWithLLM: protectedProcedure
    .input(z.object({ assetId: z.number() }))
    .mutation(async ({ input }) => {
      const attrs = await db.getDataAttributes(input.assetId);
      if (!attrs.length) return { tagged: 0, message: 'Nenhum atributo encontrado.' };

      const allAssets = await db.getDataAssets();
      const asset = allAssets.find(a => a.id === input.assetId);

      // Carrega políticas governadas para incluir no prompt
      const policies = await db.getTagPolicies();
      const governedTagsSection = policies.length > 0
        ? `\nPOLÍTICAS DE TAGS GOVERNADAS (use EXATAMENTE os valores listados quando relevante):\n` +
          policies.map(p => {
            let vals: string[] = [];
            try { vals = JSON.parse(p.allowedValues as string); } catch {}
            const valStr = vals.length > 0 ? `Valores: [${vals.join(', ')}]` : 'Valores livres (qualquer string)';
            return `- ${p.tagKey} (${p.displayName}, aplica-se a: ${p.appliesTo}): ${valStr}`;
          }).join('\n')
        : '';

      const sensitivityPolicy = policies.find(p => p.tagKey === 'DataSensitivity');
      let sensitivityValues = ['publico', 'interno', 'confidencial', 'restrito'];
      if (sensitivityPolicy) {
        try {
          const vals = JSON.parse(sensitivityPolicy.allowedValues as string) as string[];
          // Mapear valores Unity Catalog → valores internos do sistema
          const mapping: Record<string, string> = { Public: 'publico', Internal: 'interno', Confidential: 'confidencial', PersonalData: 'restrito' };
          const mapped = vals.map(v => mapping[v] ?? v.toLowerCase());
          if (mapped.length > 0) sensitivityValues = mapped;
        } catch {}
      }

      const tableData = attrs.map(a =>
        `| ${a.name} | ${a.dataType ?? 'desconhecido'} | ${(a.description ?? '').replace(/\|/g, '-')} |`
      ).join('\n');

      const prompt = `Analise as colunas da tabela "${asset?.name ?? 'desconhecida'}" e para cada coluna sugira tags de negócio, uma regra de negócio concisa e o nível de sensibilidade.

Use o comentário do catálogo (terceira coluna) como principal insumo. Se não houver comentário, infira pelo nome e tipo da coluna.

Regras de sensibilidade (use EXATAMENTE um desses valores: ${sensitivityValues.join(', ')}):
- "restrito": dados pessoais identificáveis (CPF, nome, e-mail, telefone, endereço) — LGPD
- "confidencial": dados financeiros, contratos, metas internas
- "interno": dados operacionais não-públicos
- "publico": dados agregados, IDs técnicos, referências não-identificáveis
${governedTagsSection}

Retorne APENAS JSON válido neste formato exato:
{
  "columns": [
    {
      "name": "nome_da_coluna",
      "tags": ["tag1", "tag2"],
      "businessRule": "Regra de negócio ou descrição técnica concisa.",
      "sensitivity": "publico"
    }
  ]
}

Colunas para analisar:
| Nome | Tipo | Comentário do Catálogo |
|------|------|------------------------|
${tableData}`;

      const llmResult = await invokeLLM({
        messages: [
          { role: 'system', content: 'Você é especialista em governança e catalogação de dados. Responda APENAS com JSON válido, sem markdown.' },
          { role: 'user', content: prompt },
        ],
        responseFormat: { type: 'json_object' },
      });

      const rawContent = typeof llmResult.choices[0].message.content === 'string'
        ? llmResult.choices[0].message.content
        : JSON.stringify(llmResult.choices[0].message.content);

      const parsed = JSON.parse(rawContent) as { columns?: Array<{ name: string; tags: string[]; businessRule: string; sensitivity: string }> };
      const columns = parsed.columns ?? [];

      let tagged = 0;
      for (const col of columns) {
        const attr = attrs.find(a => a.name === col.name);
        if (!attr) continue;
        const suggestion = JSON.stringify({ tags: col.tags ?? [], businessRule: col.businessRule ?? '', sensitivity: col.sensitivity ?? 'publico' });
        await db.updateDataAttribute(attr.id, { aiSuggestion: suggestion } as any);
        tagged++;
      }

      // Eleva a sensitivity do ativo ao nível mais alto encontrado entre as colunas
      const SENSITIVITY_RANK: Record<string, number> = { publico: 0, interno: 1, confidencial: 2, restrito: 3 };
      const RANK_TO_SENSITIVITY: Record<number, string> = { 0: 'publico', 1: 'interno', 2: 'confidencial', 3: 'restrito' };
      const maxRank = columns.reduce((max, col) => {
        const rank = SENSITIVITY_RANK[col.sensitivity ?? 'publico'] ?? 0;
        return rank > max ? rank : max;
      }, 0);
      const assetSensitivity = RANK_TO_SENSITIVITY[maxRank] ?? 'publico';
      if (asset) {
        await db.updateDataAsset(asset.id, { sensitivity: assetSensitivity } as any);
      }

      return { tagged, message: `${tagged} colunas tagueadas automaticamente.` };
    }),

  // ─── Preview: o que seria escrito de volta ao Databricks ─────────────────
  previewDatabricksSync: stewardProcedure
    .input(z.object({ assetId: z.number() }))
    .mutation(async ({ input }) => {
      const attrs = await db.getDataAttributes(input.assetId);
      const allAssets = await db.getDataAssets();
      const asset = allAssets.find(a => a.id === input.assetId);

      if (!asset?.fullyQualifiedName) {
        return { canSync: false, reason: 'Ativo não possui fullyQualifiedName (ex: catalog.schema.table).', commands: [] };
      }
      if (asset.sourceSystem !== 'Databricks') {
        return { canSync: false, reason: 'Ativo não é de origem Databricks.', commands: [] };
      }

      const policies = await db.getTagPolicies();
      const sensitivityPolicy = policies.find(p => p.tagKey === 'DataSensitivity');
      let sensitivityAllowed: string[] = [];
      let sensitivityMapping: Record<string, string> = {};
      if (sensitivityPolicy) {
        try { sensitivityAllowed = JSON.parse(sensitivityPolicy.allowedValues as string); } catch {}
        try { sensitivityMapping = JSON.parse(sensitivityPolicy.sensitivityMapping as string); } catch {}
      }

      const commands: Array<{ column: string; comment: string; sql: string; type: string }> = [];
      const [catalog, schema, table] = asset.fullyQualifiedName.split('.');

      for (const attr of attrs) {
        if (!attr.isVerified || !attr.aiSuggestion) continue;
        try {
          const ai = JSON.parse(attr.aiSuggestion as string);

          // COMMENT SQL
          const commentParts: string[] = [];
          if (attr.description) commentParts.push(attr.description);
          if (ai.businessRule) commentParts.push(`Regra: ${ai.businessRule}`);
          if (commentParts.length) {
            const comment = commentParts.join(' | ').replace(/'/g, "\\'");
            commands.push({
              column: attr.name,
              comment: commentParts.join(' | '),
              sql: `ALTER TABLE \`${catalog}\`.\`${schema}\`.\`${table}\` ALTER COLUMN \`${attr.name}\` COMMENT '${comment}';`,
              type: 'COMMENT',
            });
          }

          // SET TAGS SQL
          if (sensitivityPolicy && ai.sensitivity) {
            const ucValue = sensitivityMapping[ai.sensitivity as string];
            if (ucValue && sensitivityAllowed.includes(ucValue)) {
              commands.push({
                column: attr.name,
                comment: `DataSensitivity = ${ucValue}`,
                sql: `ALTER TABLE \`${catalog}\`.\`${schema}\`.\`${table}\` ALTER COLUMN \`${attr.name}\` SET TAGS ('DataSensitivity' = '${ucValue}');`,
                type: 'SET TAGS',
              });
            }
          }
        } catch { continue; }
      }

      return { canSync: true, asset: asset.name, fqn: asset.fullyQualifiedName, commands };
    }),

  // ─── Executa write-back real ao Databricks (somente admin/data_steward) ──
  pushVerifiedTagsToDatabricks: stewardProcedure
    .input(z.object({ assetId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const attrs = await db.getDataAttributes(input.assetId);
      const allAssets = await db.getDataAssets();
      const asset = allAssets.find(a => a.id === input.assetId);

      if (!asset?.fullyQualifiedName || asset.sourceSystem !== 'Databricks') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ativo sem FQN Databricks ou origem inválida.' });
      }

      const host = process.env.DATABRICKS_HOST;
      const httpPath = process.env.DATABRICKS_HTTP_PATH;
      const token = process.env.DATABRICKS_TOKEN;
      if (!host || !httpPath || !token) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Credenciais Databricks não configuradas no .env.' });
      }

      const { DatabricksAdapter } = await import('./adapters/DatabricksAdapter');
      const adapter = new DatabricksAdapter({ host, httpPath, token, catalog: process.env.DATABRICKS_CATALOG });

      // Carrega políticas governadas para mapear sensitivity → tag Unity Catalog
      const policies = await db.getTagPolicies();
      const sensitivityPolicy = policies.find(p => p.tagKey === 'DataSensitivity');
      let sensitivityAllowed: string[] = [];
      let sensitivityMapping: Record<string, string> = {};
      if (sensitivityPolicy) {
        try { sensitivityAllowed = JSON.parse(sensitivityPolicy.allowedValues as string); } catch {}
        try { sensitivityMapping = JSON.parse(sensitivityPolicy.sensitivityMapping as string); } catch {}
      }

      const [catalog, schema, table] = asset.fullyQualifiedName.split('.');
      const results: Array<{ column: string; status: 'ok' | 'error'; message: string }> = [];

      await (adapter as any).withSession(async (session: any) => {
        for (const attr of attrs) {
          if (!attr.isVerified || !attr.aiSuggestion) continue;
          try {
            const ai = JSON.parse(attr.aiSuggestion as string);

            // 1. Escreve COMMENT enriquecido (descrição + regra)
            const commentParts: string[] = [];
            if (attr.description) commentParts.push(attr.description);
            if (ai.businessRule) commentParts.push(`Regra: ${ai.businessRule}`);
            if (commentParts.length) {
              const comment = commentParts.join(' | ').replace(/'/g, "\\'");
              const commentSql = `ALTER TABLE \`${catalog}\`.\`${schema}\`.\`${table}\` ALTER COLUMN \`${attr.name}\` COMMENT '${comment}'`;
              await (adapter as any).query(session, commentSql);
            }

            // 2. Escreve Tags Governadas (SET TAGS) — apenas DataSensitivity por enquanto
            const tagPairs: string[] = [];
            if (sensitivityPolicy && ai.sensitivity) {
              const ucValue = sensitivityMapping[ai.sensitivity as string];
              if (ucValue && sensitivityAllowed.includes(ucValue)) {
                tagPairs.push(`'DataSensitivity' = '${ucValue}'`);
              }
            }
            if (tagPairs.length) {
              const tagSql = `ALTER TABLE \`${catalog}\`.\`${schema}\`.\`${table}\` ALTER COLUMN \`${attr.name}\` SET TAGS (${tagPairs.join(', ')})`;
              await (adapter as any).query(session, tagSql);
            }

            results.push({ column: attr.name, status: 'ok', message: 'Sincronizado com COMMENT + SET TAGS.' });
          } catch (err: any) {
            results.push({ column: attr.name, status: 'error', message: err?.message ?? String(err) });
          }
        }
      });

      const succeeded = results.filter(r => r.status === 'ok').length;
      console.log(`[DatabricksSync] ${ctx.user.email} sincronizou ${succeeded}/${results.length} colunas de "${asset.name}" (COMMENT + SET TAGS).`);
      return { succeeded, total: results.length, results };
    }),

  // ─── Alimenta Glossário de Negócios com termos extraídos via LLM ─────────
  pushToGlossaryWithLLM: stewardProcedure
    .input(z.object({ assetId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const attrs = await db.getDataAttributes(input.assetId);
      const allAssets = await db.getDataAssets();
      const asset = allAssets.find(a => a.id === input.assetId);
      if (!attrs.length) return { created: 0, skipped: 0, message: 'Nenhum atributo.' };

      const colsText = attrs.map(a => {
        let ai: any = {};
        try { ai = a.aiSuggestion ? JSON.parse(a.aiSuggestion as string) : {}; } catch {}
        return `- ${a.name} (${a.dataType ?? '?'}): ${a.description || ai.businessRule || ''}`;
      }).join('\n');

      const prompt = `Você é especialista em glossário de dados de negócio. Analise as colunas da tabela "${asset?.name ?? 'desconhecida'}" e extraia termos de negócio que merecem entrar em um glossário corporativo.

Para cada termo extraído forneça:
- term: nome do termo de negócio (ex: "Canal de Atendimento")  
- abbreviation: sigla se houver (ex: "CA") ou vazio
- definition: definição clara e objetiva de 1-3 frases
- category: categoria do domínio (ex: "Atendimento", "Cliente", "Financeiro", "Produto")
- examples: exemplo prático de uso

Retorne APENAS JSON válido:
{ "terms": [ { "term": "...", "abbreviation": "...", "definition": "...", "category": "...", "examples": "..." } ] }

Colunas da tabela:
${colsText}`;

      const llmResult = await invokeLLM({
        messages: [
          { role: 'system', content: 'Você é especialista em governança corporativa de dados. Responda APENAS com JSON válido.' },
          { role: 'user', content: prompt },
        ],
        responseFormat: { type: 'json_object' },
      });

      const raw = typeof llmResult.choices[0].message.content === 'string'
        ? llmResult.choices[0].message.content
        : JSON.stringify(llmResult.choices[0].message.content);
      const parsed = JSON.parse(raw) as { terms?: Array<{ term: string; abbreviation?: string; definition: string; category?: string; examples?: string }> };
      const terms = parsed.terms ?? [];

      const existing = await db.getGlossaryTerms({});
      const existingNames = new Set(existing.map((t: any) => t.term.toLowerCase().trim()));

      let created = 0, skipped = 0;
      for (const t of terms) {
        if (!t.term || !t.definition) { skipped++; continue; }
        if (existingNames.has(t.term.toLowerCase().trim())) { skipped++; continue; }
        await db.createGlossaryTerm({
          term: t.term,
          definition: t.definition,
          abbreviation: t.abbreviation || undefined,
          category: t.category || 'Geral',
          examples: t.examples || undefined,
          status: 'rascunho',
          notes: `Gerado automaticamente via IA a partir do ativo "${asset?.name ?? ''}" por ${ctx.user.email}.`,
        } as any);
        existingNames.add(t.term.toLowerCase().trim());
        created++;
      }

      return { created, skipped, message: `${created} termos criados, ${skipped} ignorados (já existentes ou incompletos).` };
    }),

  // ─── Tag Policies — CRUD de políticas de tags governadas ─────────────────
  getTagPolicies: publicProcedure.query(() => db.getTagPolicies()),

  getTagPolicyStats: publicProcedure.query(() => db.getTagPolicyStats()),

  getTagAssignmentCounts: publicProcedure
    .input(z.object({ tagKeys: z.array(z.string()) }))
    .query(({ input }) => db.getTagAssignmentCounts(input.tagKeys)),

  // Retorna conformidade por ativo: verifica se as políticas obrigatórias estão presentes em aiSuggestion
  getTagComplianceByAsset: publicProcedure
    .input(z.object({ requiredTagKeys: z.array(z.string()) }))
    .query(async ({ input }) => {
      const { requiredTagKeys } = input;
      if (requiredTagKeys.length === 0) return [];

      const allAssets = await db.getDataAssets();

      const results = await Promise.all(
        allAssets.slice(0, 30).map(async (asset: any) => {
          const attrs = await db.getDataAttributes(asset.id);
          // Agrega todas as tags mencionadas nos aiSuggestion dos atributos deste ativo
          const tagValueMap: Record<string, string[]> = {};
          for (const attr of attrs) {
            if (!attr.aiSuggestion) continue;
            try {
              const ai = JSON.parse(attr.aiSuggestion as string) as {
                tags?: string[]; sensitivity?: string;
              };
              // tags do auto-tag: podem ser "DataSensitivity" ou "DataSensitivity=Internal"
              for (const tag of (ai.tags ?? [])) {
                const [key, val] = tag.includes('=') ? tag.split('=') : [tag, 'set'];
                if (!tagValueMap[key]) tagValueMap[key] = [];
                if (!tagValueMap[key].includes(val)) tagValueMap[key].push(val);
              }
              // DataSensitivity vem também de sensitivity
              if (ai.sensitivity && !tagValueMap['DataSensitivity']) {
                tagValueMap['DataSensitivity'] = [ai.sensitivity];
              }
            } catch {}
          }
          const tagsPresent = tagValueMap;
          const tagsMissing = requiredTagKeys.filter(k => !tagsPresent[k] || tagsPresent[k].length === 0);
          return {
            assetId: asset.id,
            assetName: asset.name,
            tagsPresent,
            tagsMissing,
            isConforming: tagsMissing.length === 0,
          };
        })
      );
      return results;
    }),

  saveTagPolicy: stewardProcedure
    .input(z.object({
      id: z.number().optional(),
      tagKey: z.string().min(1).max(256),
      displayName: z.string().min(1).max(256),
      description: z.string().optional(),
      allowedValues: z.array(z.string()),
      isRequired: z.boolean().default(false),
      autoSync: z.boolean().default(false),
      appliesTo: z.enum(['table', 'column', 'both']).default('both'),
      category: z.string().max(128).optional(),
      colorMap: z.record(z.string(), z.string()).optional(),
      sensitivityMapping: z.record(z.string(), z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const data = {
        tagKey: input.tagKey.trim(),
        displayName: input.displayName.trim(),
        description: input.description ?? null,
        allowedValues: JSON.stringify(input.allowedValues),
        isRequired: input.isRequired,
        autoSync: input.autoSync,
        appliesTo: input.appliesTo as 'table' | 'column' | 'both',
        category: input.category ?? 'compliance',
        colorMap: input.colorMap ? JSON.stringify(input.colorMap) : '{}',
        sensitivityMapping: input.sensitivityMapping ? JSON.stringify(input.sensitivityMapping) : '{}',
        createdById: ctx.user.id,
      };
      if (input.id) {
        await db.updateTagPolicy(input.id, data as any);
      } else {
        await db.createTagPolicy(data as any);
      }
      return { success: true };
    }),

  deleteTagPolicy: stewardProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteTagPolicy(input.id);
      return { success: true };
    }),

  // ─── Sugerir tags governadas com IA (Gemini) ─────────────────────────────
  suggestTagsWithLLM: protectedProcedure
    .input(z.object({ assetId: z.number() }))
    .mutation(async ({ input }) => {
      const allAssets = await db.getDataAssets();
      const asset = allAssets.find(a => a.id === input.assetId);
      if (!asset) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ativo não encontrado.' });

      const attrs = await db.getDataAttributes(input.assetId);
      const policies = await db.getTagPolicies();

      // Montar resumo das políticas e seus valores permitidos para o prompt
      const policyDescriptions = policies.map(p => {
        let vals: string[] = [];
        try { vals = JSON.parse(p.allowedValues as string); } catch {}
        const valsStr = vals.length > 0 ? `Valores: [${vals.join(', ')}]` : 'Forma livre';
        return `- ${p.tagKey} (${p.displayName}): ${p.description ?? ''} ${valsStr}`;
      }).join('\n');

      // Resumo das colunas
      const columnSummary = attrs.slice(0, 40).map(a => {
        let aiInfo = '';
        try {
          const ai = JSON.parse(a.aiSuggestion as string);
          if (ai.sensitivity) aiInfo += ` [sens:${ai.sensitivity}]`;
          if (ai.tags?.length) aiInfo += ` [tags:${ai.tags.join(',')}]`;
        } catch {}
        return `${a.name} (${a.dataType ?? 'text'})${aiInfo}${a.isPii ? ' [PII]' : ''}`;
      }).join(', ');

      const prompt = `Você é um especialista em governança de dados e conformidade LGPD.

ATIVO: ${asset.name}
DESCRIÇÃO: ${asset.description ?? 'Não informada'}
SISTEMA: ${asset.sourceSystem ?? 'Desconhecido'}
ÁREA: ${asset.businessArea ?? 'Não informada'}
COLUNAS (amostra): ${columnSummary || 'Nenhuma coluna disponível'}

POLÍTICAS DE TAGS GOVERNADAS DISPONÍVEIS:
${policyDescriptions}

Com base nos metadados acima, sugira valores para CADA política de tag disponível que se apliquem a ESTE ATIVO DE DADOS.
Responda SOMENTE em JSON válido no formato:
{
  "suggestions": [
    { "tagKey": "DataSensitivity", "suggestedValue": "PersonalData", "confidence": 0.9, "rationale": "Contém CPF e email" },
    { "tagKey": "Regulation", "suggestedValue": "LGPD", "confidence": 0.95, "rationale": "Dados pessoais identificáveis" }
  ],
  "assetSummary": "Breve resumo do ativo em 1-2 frases"
}
Inclua apenas as tags que fazem sentido para o ativo. Use somente valores que estejam nos valores permitidos de cada política (quando especificados).`;

      const response = await invokeLLM({
        messages: [{ role: 'user', content: prompt }],
      });

      const rawContent = typeof (response.choices[0]?.message?.content) === "string"
        ? response.choices[0]!.message!.content as string
        : "";
      const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/) ?? rawContent.match(/(\{[\s\S]*\})/);
      const jsonStr = jsonMatch?.[1] ?? rawContent.trim();

      let parsed: { suggestions: Array<{ tagKey: string; suggestedValue: string; confidence: number; rationale: string }>; assetSummary: string };
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'LLM retornou resposta inválida. Tente novamente.' });
      }

      return {
        assetId: input.assetId,
        assetName: asset.name,
        assetSummary: parsed.assetSummary ?? '',
        suggestions: parsed.suggestions ?? [],
      };
    }),

  getQualityRules: publicProcedure.input(z.object({ assetId: z.number() })).query(({ input }) =>
    db.getQualityRules(input.assetId)
  ),
  updateQualityRule: protectedProcedure.input(z.object({
    assetId: z.number(),
    ruleType: z.enum(['completude', 'unicidade', 'validade', 'consistencia', 'regex']),
    threshold: z.number(),
    columnName: z.string().optional(),
    params: z.string().optional(),
    customPattern: z.string().optional(),
  })).mutation(({ input }) => db.upsertQualityRule(input)),

  runChecks: protectedProcedure.input(z.object({ assetId: z.number() })).mutation(async ({ input }) => {
    const { qualityEngine } = await import("./qualityEngine");
    try {
      await qualityEngine.runChecksForAsset(input.assetId);
      await cache.flush("assets:"); // invalida cache para o frontend ver score atualizado
      return { ok: true, message: "Checks executados com sucesso." };
    } catch (err: any) {
      // Não retorna 500 — devolve o erro como mensagem para o frontend
      return { ok: false, message: err?.message ?? "Erro ao executar checks" };
    }
  }),

  runGlobalChecks: protectedProcedure.mutation(async () => {
    const { qualityEngine } = await import("./qualityEngine");
    const result = await qualityEngine.runGlobalQualityCheck();
    await cache.flush("assets:"); // invalida cache após scan global
    return result;
  }),

  listAdapters: protectedProcedure.query(async () => {
    const { listAdapters } = await import("./adapters/index");
    return listAdapters();
  }),

  testAdapter: protectedProcedure.input(z.object({
    sourceSystem: z.string().optional(),
  })).mutation(async ({ input }) => {
    const { getAdapter } = await import("./adapters/index");
    const adapter = getAdapter(input.sourceSystem);
    const ok = await adapter.testConnection();
    return { ok, name: adapter.name };
  }),

  /** Notifica todos os owners de ativos dependentes sobre uma manutenção */
  notifyLineageImpact: protectedProcedure.input(z.object({
    assetId: z.number(),
    reason: z.string(),
    resolution: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const lineage = await db.getAllDataLineage();
    const assets = await db.getDataAssets({});
    const users = await db.getAllUsers();
    
    // Encontrar todos os dependentes (downstream)
    const dependentIds = new Set<number>();
    const stack = [input.assetId];
    while(stack.length > 0) {
      const currentId = stack.pop()!;
      lineage.filter(e => e.sourceAssetId === currentId).forEach(e => {
        if (!dependentIds.has(e.targetAssetId)) {
          dependentIds.add(e.targetAssetId);
          stack.push(e.targetAssetId);
        }
      });
    }

    if (dependentIds.size === 0) return { notifiedCount: 0 };

    const sourceAsset = assets.find(a => a.id === input.assetId);
    const targetAssets = assets.filter(a => dependentIds.has(a.id));
    
    // Coletar e-mails dos owners e stewards dos dependentes
    const recipientEmails = new Set<string>();
    targetAssets.forEach(a => {
      if (a.ownerId) {
        const owner = users.find(u => u.id === a.ownerId);
        if (owner?.email) recipientEmails.add(owner.email);
      }
      if (a.stewardId) {
        const steward = users.find(u => u.id === a.stewardId);
        if (steward?.email) recipientEmails.add(steward.email);
      }
    });

    const { queueAndSendEmail, buildLineageImpactEmail } = await import("./emailService");
    const html = buildLineageImpactEmail({
      assetName: sourceAsset?.name || "Ativo Desconhecido",
      impactReason: input.reason,
      expectedResolution: input.resolution
    });

    let notifiedCount = 0;
    for (const email of recipientEmails) {
      await queueAndSendEmail({
        type: "custom",
        recipientEmail: email,
        subject: `[ALERTA DE IMPACTO] Dependência de Dados: ${sourceAsset?.name}`,
        html
      });
      notifiedCount++;
    }

    await db.createAuditLog({
      userId: ctx.user?.id, userEmail: ctx.user?.email, userName: ctx.user?.name,
      action: "update" as any, entity: "data_lineage", entityId: input.assetId,
      details: { reason: input.reason, notifiedRecipients: Array.from(recipientEmails) },
      ipAddress: ctx.req?.ip,
    });

    return { notifiedCount };
  }),

  // ─── Orquestração Multiagente ──────────────────────────────────────────────────────────────
  /** Executa o pipeline completo de agentes LLM para um ativo específico */
  runGovernanceAgents: stewardProcedure
    .input(z.object({
      assetId: z.number(),
      agents: z.array(z.enum(['inspection', 'classification', 'documentation', 'audit'])).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { runGovernanceAgents } = await import('./agentOrchestrator');
      const result = await runGovernanceAgents({
        assetId: input.assetId,
        agents: input.agents,
      });
      await db.createAuditLog({
        userId: ctx.user?.id, userEmail: ctx.user?.email, userName: ctx.user?.name,
        action: 'update' as any, entity: 'data_asset', entityId: input.assetId,
        details: { action: 'governance_agents_run', runId: result.runId, summary: result.summary },
        ipAddress: ctx.req?.ip,
      });
      return result;
    }),

  /** Executa o pipeline de agentes para todos os ativos ativos (varredura global) */
  runGlobalGovernanceAgents: stewardProcedure
    .input(z.object({
      maxAssets: z.number().min(1).max(50).default(10),
      agents: z.array(z.enum(['inspection', 'classification', 'documentation', 'audit'])).optional(),
    }))
    .mutation(async ({ input }) => {
      const { runGlobalGovernanceAgents } = await import('./agentOrchestrator');
      return runGlobalGovernanceAgents({ maxAssets: input.maxAssets, agents: input.agents });
    }),

  // ─── Políticas Automáticas Databricks (Masking/RLS/CLS) ────────────────────────────────────────────
  // ─── Fluxo de Aprovação de Políticas PII (Masking/RLS/CLS no Unity Catalog) ──────────────────
  // Espelho do padrão previewDatabricksSync / pushVerifiedTagsToDatabricks da curadoria.
  // Ciclo: pendente_revisao → aprovado → sincronizado (via botão "Sync Databricks")

  /** ETAPA 1 — Gera preview dos SQLs que seriam aplicados (sem executar nada) */
  previewPiiPolicies: stewardProcedure
    .input(z.object({
      assetId: z.number(),
      applyMasking: z.boolean().default(true),
      applyColumnRevoke: z.boolean().default(true),
      applyRls: z.boolean().default(false),
      rlsUserColumn: z.string().optional(),
      bypassGroups: z.array(z.string()).optional(),
    }))
    .query(async ({ input }) => {
      const { previewPiiPolicies } = await import('./databricksPolicyService');
      const { scanTable } = await import('./piiScanner');

      const attrs = await db.getDataAttributes(input.assetId);
      const columns = attrs.map((a: any) => ({ name: a.name, type: a.dataType ?? 'string' }));
      const scanResult = scanTable(columns);
      const piiColumns = scanResult.piiColumns.map((c) => ({ name: c.name, piiResult: c.result }));

      return previewPiiPolicies(input.assetId, piiColumns, {
        applyMasking: input.applyMasking,
        applyColumnRevoke: input.applyColumnRevoke,
        applyRls: input.applyRls,
        rlsUserColumn: input.rlsUserColumn,
        bypassGroups: input.bypassGroups,
      });
    }),

  /** RETORNA A LISTA DE GRUPOS DO DATABRICKS VIA SCIM API (Cenário 3) */
  getDatabricksGroups: stewardProcedure
    .query(async () => {
      const fallbackGroups = [
        "data_steward", "data_owner", "admins", "data_science", 
        "data_engineering", "marketing", "finance", "hr_confidential"
      ];

      const configs = await db.getConnectorConfigs();
      const databricksCfg = configs.find(c => c.connectorType?.toLowerCase() === 'databricks' && c.active);
      const settings = databricksCfg?.configJson 
        ? (typeof databricksCfg.configJson === 'string' ? JSON.parse(databricksCfg.configJson) : databricksCfg.configJson) 
        : {};

      const rawHost = settings.host || process.env.DATABRICKS_HOST;
      let host = rawHost?.replace(/\/$/, "");
      
      if (host && !host.startsWith("http")) {
        host = `https://${host}`;
      }

      const { resolveDatabricksToken } = await import('./akvResolver');
      const token = await resolveDatabricksToken({
        authMode: settings.authMode || process.env.DATABRICKS_AUTH_MODE || "entra_id",
        token: settings.token || process.env.DATABRICKS_TOKEN
      });

      if (!host || !token) {
        console.log("[Databricks] Credenciais não encontradas. Retornando grupos MOCK.");
        return fallbackGroups;
      }

      try {
        const response = await fetch(`${host}/api/2.0/preview/scim/v2/Groups`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          console.warn(`[Databricks] Falha ao buscar grupos (SCIM API): HTTP ${response.status}. Usando MOCK.`);
          return fallbackGroups;
        }

        const data = await response.json();
        // A API do SCIM retorna os grupos no array 'Resources', cada um com 'displayName'
        if (data.Resources && Array.isArray(data.Resources)) {
          const databricksGroups = data.Resources.map((g: any) => g.displayName).filter(Boolean);
          if (databricksGroups.length > 0) {
            return databricksGroups as string[];
          }
        }
        
        return fallbackGroups;
      } catch (error) {
        console.error("[Databricks] Erro ao buscar grupos via SCIM API:", error);
        return fallbackGroups;
      }
    }),

  /** ETAPA 2a — Steward aprova as políticas (ainda não executa no Databricks) */
  approvePiiPolicies: stewardProcedure
    .input(z.object({
      assetId: z.number(),
      notes: z.string().optional(),
      bypassGroups: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { approvePiiPolicies } = await import('./databricksPolicyService');
      await approvePiiPolicies(input.assetId, ctx.user.email ?? '', input.notes, input.bypassGroups);

      await db.createAuditLog({
        userId: ctx.user?.id, userEmail: ctx.user?.email, userName: ctx.user?.name,
        action: 'update' as any, entity: 'data_asset', entityId: input.assetId,
        details: { action: 'pii_policy_approved', notes: input.notes },
        ipAddress: ctx.req?.ip,
      });

      return { success: true, message: 'Políticas aprovadas. Use o botão "Sync Databricks" para aplicar no Unity Catalog.' };
    }),

  /** ETAPA 2b — Steward rejeita as políticas */
  rejectPiiPolicies: stewardProcedure
    .input(z.object({
      assetId: z.number(),
      reason: z.string().min(1, 'Informe o motivo da rejeição.'),
    }))
    .mutation(async ({ input, ctx }) => {
      const { rejectPiiPolicies } = await import('./databricksPolicyService');
      await rejectPiiPolicies(input.assetId, ctx.user.email ?? '', input.reason);

      await db.createAuditLog({
        userId: ctx.user?.id, userEmail: ctx.user?.email, userName: ctx.user?.name,
        action: 'update' as any, entity: 'data_asset', entityId: input.assetId,
        details: { action: 'pii_policy_rejected', reason: input.reason },
        ipAddress: ctx.req?.ip,
      });

      return { success: true, message: 'Políticas rejeitadas. Nenhuma alteração será feita no Unity Catalog.' };
    }),

  /** ETAPA 2c — Cancela rejeição e reabre para revisão */
  resetPiiPolicyReview: stewardProcedure
    .input(z.object({ assetId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const { resetPiiPolicyReview } = await import('./databricksPolicyService');
      await resetPiiPolicyReview(input.assetId);

      await db.createAuditLog({
        userId: ctx.user?.id, userEmail: ctx.user?.email, userName: ctx.user?.name,
        action: 'update' as any, entity: 'data_asset', entityId: input.assetId,
        details: { action: 'pii_policy_review_reset' },
        ipAddress: ctx.req?.ip,
      });

      return { success: true, message: 'Revisão reaberta. O ativo voltou ao status pendente_revisao.' };
    }),

  /** ETAPA 3 — Botão "Sync Databricks": aplica as políticas aprovadas no Unity Catalog */
  syncApprovedPiiPolicies: stewardProcedure
    .input(z.object({
      assetId: z.number(),
      applyMasking: z.boolean().default(true),
      applyColumnRevoke: z.boolean().default(true),
      applyRls: z.boolean().default(false),
      rlsUserColumn: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { getDatabricksPolicyConfig, syncApprovedPiiPolicies } = await import('./databricksPolicyService');
      const { scanTable } = await import('./piiScanner');

      const policyConfig = getDatabricksPolicyConfig();
      if (!policyConfig) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Credenciais Databricks não configuradas (DATABRICKS_HOST / DATABRICKS_TOKEN).' });
      }

      const attrs = await db.getDataAttributes(input.assetId);
      const columns = attrs.map((a: any) => ({ name: a.name, type: a.dataType ?? 'string' }));
      const scanResult = scanTable(columns);
      const piiColumns = scanResult.piiColumns.map((c) => ({ name: c.name, piiResult: c.result }));

      // syncApprovedPiiPolicies lança erro se o status não for 'aprovado'
      let summary;
      try {
        summary = await syncApprovedPiiPolicies(policyConfig, input.assetId, piiColumns, {
          applyMasking: input.applyMasking,
          applyColumnRevoke: input.applyColumnRevoke,
          applyRls: input.applyRls,
          rlsUserColumn: input.rlsUserColumn,
        });
      } catch (err: any) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: err?.message ?? String(err) });
      }

      const allAssets = await db.getDataAssets();
      const asset = allAssets.find((a: any) => a.id === input.assetId);

      await db.createAuditLog({
        userId: ctx.user?.id, userEmail: ctx.user?.email, userName: ctx.user?.name,
        action: 'update' as any, entity: 'data_asset', entityId: input.assetId,
        details: { action: 'pii_policies_synced_to_databricks', ...summary },
        ipAddress: ctx.req?.ip,
      });

      // Notifica via Teams que políticas foram sincronizadas
      const { sendGovernanceAlert } = await import('./teamsGovernanceAlerts');
      await sendGovernanceAlert({
        type: 'policy_applied',
        assetName: asset?.name ?? `Ativo #${input.assetId}`,
        assetId: input.assetId,
        policiesApplied: summary.applied,
      }).catch(() => {});

      return summary;
    }),

  /** Lista todos os ativos com políticas PII pendentes de revisão */
  getPiiPolicyPendingAssets: stewardProcedure
    .query(async () => {
      const { getAssetsPendingPiiReview } = await import('./databricksPolicyService');
      return getAssetsPendingPiiReview();
    }),

  // ─── Alertas Teams de Governança ──────────────────────────────────────────────────────────────────────────────
  /** Verifica se o webhook de alertas de governança está configurado */
  getTeamsGovernanceStatus: publicProcedure.query(async () => {
    const { isTeamsGovernanceConfigured } = await import('./teamsGovernanceAlerts');
    return {
      configured: isTeamsGovernanceConfigured(),
      webhookUrl: process.env.TEAMS_GOVERNANCE_WEBHOOK_URL
        ? '(configurado)'
        : null,
    };
  }),

  /** Envia um alerta de teste para o canal de governança do Teams */
  sendTeamsGovernanceTestAlert: stewardProcedure
    .input(z.object({ assetId: z.number().optional() }))
    .mutation(async ({ input }) => {
      const { sendGovernanceAlert } = await import('./teamsGovernanceAlerts');
      const result = await sendGovernanceAlert({
        type: 'audit_risk',
        assetName: 'Teste de Alerta — Portal de Governança',
        assetId: input.assetId,
        riskScore: 85,
        complianceStatus: 'needs_review',
        recommendations: [
          'Verificar políticas de acesso',
          'Aplicar mascaramento em colunas PII',
          'Revisar base legal LGPD',
        ],
        severity: 'high',
        runId: `test-${Date.now()}`,
      });
      return result;
    }),

  /** Dispara alerta manual de PII detectado para um ativo */
  sendPiiDetectedAlert: stewardProcedure
    .input(z.object({ assetId: z.number() }))
    .mutation(async ({ input }) => {
      const { sendGovernanceAlert } = await import('./teamsGovernanceAlerts');
      const { scanTable } = await import('./piiScanner');

      const allAssets = await db.getDataAssets();
      const asset = allAssets.find((a: any) => a.id === input.assetId);
      if (!asset) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ativo não encontrado.' });

      const attrs = await db.getDataAttributes(input.assetId);
      const columns = attrs.map((a: any) => ({ name: a.name, type: a.dataType ?? 'string' }));
      const scanResult = scanTable(columns);

      return sendGovernanceAlert({
        type: 'pii_detected',
        assetName: asset.name,
        assetId: asset.id,
        piiColumns: scanResult.piiColumns.map((c) => c.name),
        piiCount: scanResult.piiCount,
        severity: scanResult.suggestedSensitivity === 'restrito' ? 'critical' : 'high',
      });
    }),

  // ─── Tier de Autonomia por Domínio ─────────────────────────────────────────

  /** Retorna as definições dos 4 Tiers de Autonomia */
  getTierDefinitions: publicProcedure.query(async () => {
    const { getAllTierDefinitions } = await import('./databricksTierPolicyService');
    return getAllTierDefinitions();
  }),

  /** Retorna os domínios com suas atribuições de Tier */
  getDomainTierAssignments: publicProcedure.query(async () => {
    const { getDomainTierAssignments } = await import('./databricksTierPolicyService');
    return getDomainTierAssignments();
  }),

  /** Gera preview das políticas que serão aplicadas para um domínio + tier */
  previewTierPolicies: stewardProcedure
    .input(z.object({
      domainId: z.number(),
      tier: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    }))
    .query(async ({ input }) => {
      const { previewTierPolicies } = await import('./databricksTierPolicyService');
      const allDomains = await db.getDomains();
      const domain = allDomains.find((d: any) => d.id === input.domainId);
      if (!domain) throw new TRPCError({ code: 'NOT_FOUND', message: 'Domínio não encontrado' });
      const catalog = (domain as any).tierDatabricksCatalog ?? `vc_${domain.name.toLowerCase().replace(/\s+/g, '_')}`;
      const schema  = (domain as any).tierDatabricksSchema  ?? domain.name.toLowerCase().replace(/\s+/g, '_');
      return previewTierPolicies(domain.name, catalog, schema, input.tier);
    }),

  /** Atribui um Tier a um domínio (status: pendente_revisao) */
  assignTierToDomain: stewardProcedure
    .input(z.object({
      domainId: z.number(),
      tier: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
      databricksCatalog: z.string().optional(),
      databricksSchema: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await db.updateDomain(input.domainId, {
        tierLevel: input.tier,
        tierStatus: 'pendente_revisao',
        tierApprovedBy: null as any,
        tierApprovedAt: null as any,
        tierSyncedAt: null as any,
        tierNotes: input.notes ?? null,
        tierDatabricksCatalog: input.databricksCatalog ?? null,
        tierDatabricksSchema: input.databricksSchema ?? null,
      } as any);
      return { ok: true, message: `Tier ${input.tier} atribuído ao domínio. Aguardando aprovação.` };
    }),

  /** Aprova a atribuição de Tier para um domínio */
  approveTierAssignment: stewardProcedure
    .input(z.object({
      domainId: z.number(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const approvedBy = ctx.user?.email ?? ctx.user?.name ?? 'steward';
      await db.updateDomain(input.domainId, {
        tierStatus: 'aprovado',
        tierApprovedBy: approvedBy,
        tierApprovedAt: new Date(),
        tierNotes: input.notes ?? null,
      } as any);
      return { ok: true, message: 'Tier aprovado. Use Sync Databricks para aplicar as políticas.' };
    }),

  /** Reverte a atribuição de Tier para revisão */
  revokeTierAssignment: stewardProcedure
    .input(z.object({ domainId: z.number(), reason: z.string() }))
    .mutation(async ({ input }) => {
      await db.updateDomain(input.domainId, {
        tierStatus: 'pendente_revisao',
        tierApprovedBy: null as any,
        tierApprovedAt: null as any,
        tierNotes: input.reason,
      } as any);
      return { ok: true, message: 'Atribuição de Tier revertida para revisão.' };
    }),

  /** Aplica as políticas de Tier no Unity Catalog (só após aprovação) */
  syncTierPolicies: stewardProcedure
    .input(z.object({ domainId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const allDomains = await db.getDomains();
      const domain = allDomains.find((d: any) => d.id === input.domainId) as any;
      if (!domain) throw new TRPCError({ code: 'NOT_FOUND', message: 'Domínio não encontrado' });
      if (domain.tierStatus !== 'aprovado') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `O Tier do domínio precisa estar aprovado antes do sync. Status atual: ${domain.tierStatus ?? 'sem_tier'}`,
        });
      }
      const { syncTierPolicies } = await import('./databricksTierPolicyService');
      const catalog = domain.tierDatabricksCatalog ?? `vc_${domain.name.toLowerCase().replace(/\s+/g, '_')}`;
      const schema  = domain.tierDatabricksSchema  ?? domain.name.toLowerCase().replace(/\s+/g, '_');
      const approvedBy = ctx.user?.email ?? ctx.user?.name ?? 'steward';
      const report = await syncTierPolicies(
        domain.id, domain.name, catalog, schema,
        domain.tierLevel as 1|2|3|4, approvedBy
      );
      if (report.applied > 0) {
        await db.updateDomain(input.domainId, {
          tierStatus: 'sincronizado',
          tierSyncedAt: report.syncedAt,
        } as any);
      }
      return report;
    }),

  /** Revoga as políticas de Tier no Unity Catalog */
  revokeTierPolicies: stewardProcedure
    .input(z.object({ domainId: z.number() }))
    .mutation(async ({ input }) => {
      const allDomains = await db.getDomains();
      const domain = allDomains.find((d: any) => d.id === input.domainId) as any;
      if (!domain) throw new TRPCError({ code: 'NOT_FOUND', message: 'Domínio não encontrado' });
      const { revokeTierPolicies } = await import('./databricksTierPolicyService');
      const catalog = domain.tierDatabricksCatalog ?? `vc_${domain.name.toLowerCase().replace(/\s+/g, '_')}`;
      const schema  = domain.tierDatabricksSchema  ?? domain.name.toLowerCase().replace(/\s+/g, '_');
      const report = await revokeTierPolicies(
        domain.id, domain.name, catalog, schema, domain.tierLevel as 1|2|3|4
      );
            await db.updateDomain(input.domainId, { tierStatus: 'revogado' } as any);
      return report;
    }),

  batchSyncTierPolicies: stewardProcedure
    .input(z.object({}).optional())
    .mutation(async () => {
      const allDomains = await db.getDomains();
      const approved = allDomains.filter((d: any) => d.tierStatus === 'aprovado' && d.tierLevel);
      const { syncTierPolicies } = await import('./databricksTierPolicyService');
      const results: any[] = [];
      let totalApplied = 0;
      let totalErrors = 0;
      for (const domain of approved) {
        try {
          const catalog = (domain as any).tierDatabricksCatalog ?? `vc_${domain.name.toLowerCase().replace(/\s+/g, '_')}`;
          const schema  = (domain as any).tierDatabricksSchema  ?? domain.name.toLowerCase().replace(/\s+/g, '_');
          const report = await syncTierPolicies(
            domain.id, domain.name, catalog, schema, (domain as any).tierLevel as 1|2|3|4, 'batch_sync'
          );
          await db.updateDomain(domain.id, { tierStatus: 'sincronizado' } as any);
          results.push({ domainId: domain.id, domainName: domain.name, tier: (domain as any).tierLevel, applied: report.applied, errors: report.failed });
          totalApplied += report.applied;
          totalErrors += report.failed;
        } catch (err: any) {
          results.push({ domainId: domain.id, domainName: domain.name, tier: (domain as any).tierLevel, applied: 0, errors: 1, errorMsg: err.message });
          totalErrors += 1;
        }
      }
      return { totalApplied, totalErrors, results };
    }),

  getTierSyncHistory: protectedProcedure
    .input(z.object({ domainId: z.number().optional(), limit: z.number().optional() }))
    .query(async ({ input }) => {
      return db.getTierSyncHistory(input.domainId, input.limit ?? 20);
    }),
});

// ─── Access Requests Router ───────────────────────────────────────────────────
const accessRequestsRouter = router({
  create: protectedProcedure.input(z.object({
    ticketNumber: z.string(),
    assetId: z.number(),
    requesterName: z.string().optional(),
    requesterEmail: z.string().optional(),
    nivelAcesso: z.enum(["leitura", "leitura_escrita"]),
    papelGrupo: z.string(),
    baseLegal: z.enum(["legitimo_interesse", "execucao_contrato"]),
    finalidade: z.string(),
    prazoNecessidade: z.string().optional(),
    checklistJson: z.string().optional(),
    envolveTerceiros: z.boolean().optional(),
    ownerId: z.number().optional(),
    stewardId: z.number().optional(),
    flowType: z.enum(["acesso_dados", "dados_restritos", "terceiros", "projeto_ia"]).optional(),
    priority: z.enum(["baixa", "media", "alta"]).optional(),
  })).mutation(({ input, ctx }) => {
    const req = db.createAccessRequest({
      ...input,
      requesterId: ctx.user?.id ?? null,
      requesterName: input.requesterName ?? ctx.user?.name ?? undefined,
      requesterEmail: input.requesterEmail ?? ctx.user?.email ?? undefined,
      status: "pendente_owner",
      statusOwner: "pendente",
      statusSteward: "aguardando",
    } as any);
    db.dispatchWebhook("access_request.created", {
      requesterEmail: input.requesterEmail ?? ctx.user?.email,
      assetId: input.assetId,
    }).catch(() => {});
    return req;
  }),

  list: protectedProcedure.input(z.object({
    status: z.string().optional(),
    assetId: z.number().optional(),
    requesterId: z.number().optional(),
    ownerId: z.number().optional(),
    stewardId: z.number().optional(),
  })).query(({ input }) => db.getAccessRequests(input)),

  getById: protectedProcedure.input(z.object({ id: z.number() }))
    .query(({ input }) => db.getAccessRequestById(input.id)),

  approveOwner: protectedProcedure.input(z.object({
    id: z.number(),
    comment: z.string().default(""),
  })).mutation(async ({ input, ctx }) => {
    const result = await db.approveByOwner(input.id, input.comment);
    await db.createAuditLog({
      userId: ctx.user?.id, userEmail: ctx.user?.email, userName: ctx.user?.name,
      action: "approve", entity: "access_request", entityId: input.id,
      details: { comment: input.comment, step: "owner" },
      ipAddress: ctx.req?.ip,
    });
    db.dispatchWebhook("access_request.approved", {
      id: input.id,
      step: "owner",
      approvedBy: ctx.user?.email,
    }).catch(() => {});
    return result;
  }),

  rejectOwner: protectedProcedure.input(z.object({
    id: z.number(),
    comment: z.string(),
  })).mutation(async ({ input, ctx }) => {
    const result = await db.rejectByOwner(input.id, input.comment);
    await db.createAuditLog({
      userId: ctx.user?.id, userEmail: ctx.user?.email, userName: ctx.user?.name,
      action: "reject", entity: "access_request", entityId: input.id,
      details: { comment: input.comment, step: "owner" },
      ipAddress: ctx.req?.ip,
    });
    return result;
  }),

  approveSteward: protectedProcedure.input(z.object({
    id: z.number(),
    comment: z.string().default(""),
  })).mutation(async ({ input, ctx }) => {
    const result = await db.approveBySteward(input.id, input.comment);

    // ── Grant automático pós-aprovação ──────────────────────────────────────
    try {
      // 1. Buscar dados completos da solicitação
      const requests = await db.getAccessRequests({ assetId: undefined as any });
      const req = (await db.getAccessRequests({})).find((r: any) => r.id === input.id);
      if (req) {
        // 2. Buscar ativo para obter fullyQualifiedName + sourceSystem
        const asset = await db.getDataAssetById(req.assetId);
        if (asset && asset.fullyQualifiedName && asset.sourceSystem) {
          const sourceSystemLower = asset.sourceSystem.toLowerCase();
          if (sourceSystemLower.includes("databricks")) {
            // 3. Buscar conector Databricks ativo
            const connectors = await db.getConnectorConfigs();
            const connector = connectors.find((c: any) =>
              c.active && (c.connectorType?.toLowerCase().includes("databricks") ||
                           c.name?.toLowerCase().includes("databricks"))
            );
            if (connector && connector.configJson) {
              const cfg = typeof connector.configJson === 'string' ? JSON.parse(connector.configJson) : connector.configJson;
              if (cfg.host && cfg.token) {
                const { grantDatabricksPermission } = await import("./databricksGrantService");
                const grantResult = await grantDatabricksPermission(
                  { host: cfg.host, token: cfg.token },
                  asset.fullyQualifiedName,
                  req.requesterEmail ?? "",
                  (req.nivelAcesso as "leitura" | "leitura_escrita") ?? "leitura"
                );
                // 4. Registrar resultado no audit log
                await db.createAuditLog({
                  userId: ctx.user?.id, userEmail: ctx.user?.email, userName: ctx.user?.name,
                  action: "update" as any,
                  entity: "access_request",
                  entityId: input.id,
                  details: {
                    databricks: true,
                    fullyQualifiedName: asset.fullyQualifiedName,
                    principal: req.requesterEmail,
                    nivelAcesso: req.nivelAcesso,
                    result: grantResult,
                  },
                  ipAddress: ctx.req?.ip,
                });
              }
            } else {
              // 5. Fallback: nenhum conector Databricks configurado → notifica por email
              const { queueAndSendEmail } = await import("./emailService");
               await queueAndSendEmail({
                type: "custom",
                recipientEmail: ctx.user?.email ?? "",
                subject: `[Ação Necessária] Grant manual para ${asset.name} no Databricks`,
                html: `
                  <p>A solicitação <strong>${req.ticketNumber}</strong> foi aprovada, mas não há um conector Databricks ativo configurado para executar o grant automaticamente.</p>
                  <p><strong>Ação necessária:</strong> Execute manualmente no Unity Catalog:</p>
                  <pre>GRANT ${req.nivelAcesso === "leitura_escrita" ? "SELECT, MODIFY" : "SELECT"}
ON TABLE ${asset.fullyQualifiedName}
TO \`${req.requesterEmail}\`;</pre>
                  <p>Configure o conector em <strong>Configurações → Conectores</strong> para automação futura.</p>
                `,
              });
            }
          }
        }
      }
    } catch (grantErr) {
      // Erros no grant não devem bloquear a aprovação — apenas logar
      console.error("[approveSteward] Falha no grant automático:", grantErr);
    }
    // ── fim do grant automático ──────────────────────────────────────────────

    await db.createAuditLog({
      userId: ctx.user?.id, userEmail: ctx.user?.email, userName: ctx.user?.name,
      action: "approve", entity: "access_request", entityId: input.id,
      details: { comment: input.comment, step: "steward" },
      ipAddress: ctx.req?.ip,
    });
    return result;
  }),

  rejectSteward: protectedProcedure.input(z.object({
    id: z.number(),
    comment: z.string(),
  })).mutation(async ({ input, ctx }) => {
    const result = await db.rejectBySteward(input.id, input.comment);
    await db.createAuditLog({
      userId: ctx.user?.id, userEmail: ctx.user?.email, userName: ctx.user?.name,
      action: "reject", entity: "access_request", entityId: input.id,
      details: { comment: input.comment, step: "steward" },
      ipAddress: ctx.req?.ip,
    });
    return result;
  }),
});

// ─── Audit Log Router ────────────────────────────────────────────────────────
const auditLogRouter = router({
  list: protectedProcedure
    .input(z.object({
      userId: z.number().optional(),
      action: z.string().optional(),
      entity: z.string().optional(),
      limit: z.number().min(1).max(500).default(100),
      offset: z.number().min(0).default(0),
    }))
    .query(({ input, ctx }) => {
      // Apenas admins podem ver todos os logs; outros veem apenas os próprios
      if (ctx.user?.role !== 'admin') {
        return db.getAuditLogs({ ...input, userId: ctx.user?.id });
      }
      return db.getAuditLogs(input);
    }),
});

// ─── Business Glossary Router ────────────────────────────────────────────────
const glossaryRouter = router({
  list: publicProcedure
    .input(z.object({
      status: z.string().optional(),
      category: z.string().optional(),
      search: z.string().optional(),
      domainId: z.number().optional(),
    }))
    .query(({ input }) => db.getGlossaryTerms(input)),

  categories: publicProcedure.query(() => db.getGlossaryCategories()),

  byId: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => db.getGlossaryTermById(input.id)),

  create: protectedProcedure
    .input(z.object({
      term: z.string().min(1).max(256),
      definition: z.string().min(1),
      abbreviation: z.string().max(64).optional(),
      domainId: z.number().optional(),
      ownerId: z.number().optional(),
      status: z.enum(["rascunho", "em_revisao", "aprovado", "obsoleto"]).default("rascunho"),
      category: z.string().max(128).optional(),
      synonyms: z.string().optional(),
      examples: z.string().optional(),
      notes: z.string().optional(),
      relatedTermIds: z.string().optional(),
    }))
    .mutation(({ input, ctx }) => db.createGlossaryTerm({
      ...input,
      createdById: ctx.user?.id ?? null,
      createdByName: ctx.user?.name ?? null,
    } as any)),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      term: z.string().min(1).max(256).optional(),
      definition: z.string().min(1).optional(),
      abbreviation: z.string().max(64).optional(),
      domainId: z.number().optional(),
      ownerId: z.number().optional(),
      status: z.enum(["rascunho", "em_revisao", "aprovado", "obsoleto"]).optional(),
      category: z.string().max(128).optional(),
      synonyms: z.string().optional(),
      examples: z.string().optional(),
      notes: z.string().optional(),
      relatedTermIds: z.string().optional(),
      approvedBy: z.string().optional(),
      approvedAt: z.date().optional(),
    }))
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return db.updateGlossaryTerm(id, data);
    }),

  approve: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input, ctx }) => db.updateGlossaryTerm(input.id, {
      status: "aprovado",
      approvedBy: ctx.user?.name ?? ctx.user?.email ?? "Sistema",
      approvedAt: new Date(),
    })),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => db.deleteGlossaryTerm(input.id)),
});

// ─── Organizations Router ────────────────────────────────────────────────────
const organizationsRouter = router({
  list: protectedProcedure.query(() => db.getOrganizations()),
  byId: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => db.getOrganizationById(input.id)),
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
      logoUrl: z.string().optional(),
      primaryColor: z.string().optional(),
      secondaryColor: z.string().optional(),
      plan: z.enum(["starter", "professional", "enterprise"]).optional(),
      maxUsers: z.number().optional(),
      maxAssets: z.number().optional(),
      allowSso: z.boolean().optional(),
      defaultLocale: z.string().optional(),
      timezone: z.string().optional(),
    }))
    .mutation(({ input }) => db.createOrganization(input as any)),
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      appName: z.string().optional(),
      logoUrl: z.string().optional(),
      faviconUrl: z.string().optional(),
      primaryColor: z.string().optional(),
      secondaryColor: z.string().optional(),
      customCss: z.string().optional(),
      supportEmail: z.string().email().optional(),
      plan: z.enum(["starter", "professional", "enterprise"]).optional(),
      maxUsers: z.number().optional(),
      maxAssets: z.number().optional(),
      allowSso: z.boolean().optional(),
      active: z.boolean().optional(),
    }))
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return db.updateOrganization(id, data as any);
    }),

  // Endpoint público: auto-cadastro SaaS com trial de 14 dias
  selfServiceRegister: publicProcedure
    .input(z.object({
      name: z.string().min(2).max(128),
      email: z.string().email(),
      orgName: z.string().min(2).max(256),
      plan: z.enum(["starter", "professional", "enterprise"]).default("starter"),
      password: z.string().min(8).max(128),
    }))
    .mutation(async ({ input }) => {
      // 1. Verificar se email já existe
      const existing = await db.getUserByEmail(input.email);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "E-mail já cadastrado." });

      // 2. Criar organização com trial de 14 dias
      const slug = input.orgName.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
        .slice(0, 48) + "-" + Date.now().toString(36);

      const trialExpiresAt = new Date();
      trialExpiresAt.setDate(trialExpiresAt.getDate() + 14);

      const org = await db.createOrganization({
        name: input.orgName,
        slug,
        plan: input.plan,
        maxUsers: input.plan === "starter" ? 5 : input.plan === "professional" ? 25 : 999,
        maxAssets: input.plan === "starter" ? 100 : input.plan === "professional" ? 1000 : 999999,
        active: true,
        trialExpiresAt,
      } as any);
      const orgId = (org as any)[0]?.insertId ?? (org as any).insertId;

      // 3. Criar usuário admin da org com senha hash
      const { hashPassword } = await import("./localAuth");
      const passwordHash = await hashPassword(input.password);
      await db.createUser({
        name: input.name,
        email: input.email,
        passwordHash,
        role: "admin",
        organizationId: orgId ?? null,
        mustChangePassword: false,
      } as any);

      return { success: true, message: "Conta criada! Seu trial de 14 dias começa agora." };
    }),
});

// ─── App Router ────────────────────────────────────────────────────────────────────────────────────

// ─── SLA Router ──────────────────────────────────────────────────────────────
const slaRouter = router({
  listConfigs: protectedProcedure.query(() => db.getSlaConfigs()),
  configById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => db.getSlaConfigById(input.id)),
  createConfig: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      entityType: z.enum(['asset', 'domain', 'global']).default('global'),
      entityId: z.number().optional(),
      maxUpdateDays: z.number().min(1).max(365).optional(),
      minQualityScore: z.number().min(0).max(100).optional(),
      maxAccessResponseDays: z.number().min(1).max(90).optional(),
      alertEmails: z.string().optional(),
      alertOnBreachOnly: z.boolean().optional(),
      active: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await db.createSlaConfig({ ...input, createdById: ctx.user?.id ?? null } as any);
      
      // Audit Log for SLA Config Creation
      if (ctx.user) {
        await db.createAuditLog({
          userId: ctx.user.id,
          userEmail: ctx.user.email,
          userName: ctx.user.name,
          action: "create",
          entity: "sla_config",
          entityId: (result as any).id,
          entityName: input.name,
          details: { entityType: input.entityType, entityId: input.entityId },
          ipAddress: ctx.req?.ip,
        });
      }
      return result;
    }),
  updateConfig: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      maxUpdateDays: z.number().optional(),
      minQualityScore: z.number().optional(),
      maxAccessResponseDays: z.number().optional(),
      alertEmails: z.string().optional(),
      alertOnBreachOnly: z.boolean().optional(),
      active: z.boolean().optional(),
    }))
    .mutation(({ input }) => { const { id, ...data } = input; return db.updateSlaConfig(id, data as any); }),
  deleteConfig: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => db.deleteSlaConfig(input.id)),
  listViolations: protectedProcedure
    .input(z.object({ resolved: z.boolean().optional(), entityType: z.string().optional(), limit: z.number().optional(), offset: z.number().optional() }).optional())
    .query(({ input }) => db.getSlaViolations(input ?? {})),
  resolveViolation: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => db.resolveSlaViolation(input.id)),
});

// ─── Webhooks Router ──────────────────────────────────────────────────────────
const webhooksRouter = router({
  list: protectedProcedure.query(() => db.getWebhookConfigs()),
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      url: z.string().url(),
      secret: z.string().optional(),
      events: z.array(z.string()).min(1),
      active: z.boolean().optional(),
    }))
    .mutation(({ input, ctx }) => db.createWebhookConfig({ ...input, events: input.events as any, createdById: ctx.user?.id ?? null } as any)),
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      url: z.string().url().optional(),
      secret: z.string().optional(),
      events: z.array(z.string()).optional(),
      active: z.boolean().optional(),
    }))
    .mutation(({ input }) => { const { id, ...data } = input; return db.updateWebhookConfig(id, data as any); }),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => db.deleteWebhookConfig(input.id)),
  deliveries: protectedProcedure
    .input(z.object({ webhookConfigId: z.number(), limit: z.number().optional() }))
    .query(({ input }) => db.getWebhookDeliveries(input.webhookConfigId, input.limit)),
  testDispatch: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const wh = await db.getWebhookConfigById(input.id);
      if (!wh) throw new TRPCError({ code: 'NOT_FOUND' });
      await db.dispatchWebhook('test', { message: 'Teste de conexão do Lucid Data Governance', webhookId: input.id });
      return { sent: true };
    }),
});

// ─── SSO Router ───────────────────────────────────────────────────────────────
const ssoRouter = router({
  getConfig: protectedProcedure
    .input(z.object({ organizationId: z.number() }))
    .query(({ input }) => db.getSsoConfigByOrg(input.organizationId)),
  upsertConfig: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      provider: z.enum(['saml', 'oidc']).default('saml'),
      entryPoint: z.string().optional(),
      issuer: z.string().optional(),
      certificate: z.string().optional(),
      callbackUrl: z.string().optional(),
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      discoveryUrl: z.string().optional(),
      active: z.boolean().optional(),
    }))
    .mutation(({ input }) => db.upsertSsoConfig(input as any)),
});

// ─── API Keys Router ──────────────────────────────────────────────────────────
const apiKeysRouter = router({
  list: protectedProcedure.query(({ ctx }) => {
    const isAdmin = ctx.user?.role === 'admin';
    return db.getApiKeys(isAdmin ? undefined : ctx.user?.id);
  }),
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(256),
      scopes: z.array(z.string()).min(1),
      expiresInDays: z.number().min(1).max(3650).optional(),
    }))
    .mutation(({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: 'UNAUTHORIZED' });
      return db.createApiKey(input.name, input.scopes, ctx.user.id, input.expiresInDays);
    }),
  revoke: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: 'UNAUTHORIZED' });
      return db.revokeApiKey(input.id, ctx.user.id, ctx.user.role === 'admin');
    }),
});

// ─── Maturity / LGPD Router ───────────────────────────────────────────────────

/**
 * Gera recomendações acionáveis baseadas no framework DMBoK 2.0 / DCAM 2.0.
 * Dimensões avaliadas: as mesmas retornadas por db.getMaturityScore()
 */
function generateDMBoKRecommendations(score: Awaited<ReturnType<typeof db.getMaturityScore>>) {
  type Dimension = { dimension: string; score: number };
  const dims = (score as unknown as { dimensions?: Dimension[] })?.dimensions ?? [];

  const DMBOK_KNOWLEDGE_AREAS: Record<string, { label: string; actions: string[] }> = {
    governança: {
      label: "Governança de Dados (DMBOK KA1)",
      actions: [
        "Definir e publicar política formal de governança de dados aprovada pelo comitê.",
        "Estabelecer RACI para todas as decisões de dados com ownership declarado.",
        "Implementar ciclo trimestral de revisão de políticas com registro de aprovação.",
      ],
    },
    qualidade: {
      label: "Qualidade de Dados (DMBOK KA9)",
      actions: [
        "Criar perfis de qualidade (completude, unicidade, validade, consistência) para todos os ativos críticos.",
        "Definir SLAs de qualidade por domínio com alertas automáticos.",
        "Implementar processo de remediação com prazo SLA máximo de 5 dias úteis.",
      ],
    },
    metadados: {
      label: "Gestão de Metadados (DMBOK KA12)",
      actions: [
        "Garantir que 100% dos ativos críticos possuam dono, steward e classificação de sensibilidade.",
        "Publicar dicionário de dados no glossário de negócios com termos aprovados.",
        "Automatizar coleta de metadados técnicos via crawlers ativos no catálogo.",
      ],
    },
    linhagem: {
      label: "Arquitetura de Dados (DMBOK KA2)",
      actions: [
        "Documentar linhagem ponta-a-ponta (origem → consumo) para ativos críticos.",
        "Registrar impacto upstream/downstream antes de qualquer mudança estrutural.",
        "Utilizar análise what-if para validar impacto de alterações em pipelines.",
      ],
    },
    segurança: {
      label: "Segurança de Dados (DMBOK KA7)",
      actions: [
        "Revisar controles de acesso por função (RBAC) com recertificação semestral.",
        "Classificar todos os dados PII com controles de mascaramento ativados.",
        "Conduzir DPIA (PIA) para todos os tratamentos de dados sensíveis.",
      ],
    },
    compliance: {
      label: "Conformidade e LGPD (DMBOK KA13 / DCAM)",
      actions: [
        "Completar mapeamento de tratamento de dados pessoais no registro de ativos.",
        "Implementar processo de resposta a DSARs com SLA de 15 dias corridos.",
        "Registrar base legal para cada finalidade de tratamento no catálogo.",
      ],
    },
  };

  const recommendations: Array<{
    dimension: string;
    level: "crítico" | "atenção" | "bom" | "ótimo";
    score: number;
    framework: string;
    actions: string[];
  }> = [];

  for (const dim of dims) {
    const key = dim.dimension.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const found = Object.entries(DMBOK_KNOWLEDGE_AREAS).find(([k]) =>
      key.includes(k) || k.includes(key.split(" ")[0]),
    );
    const meta = found?.[1] ?? { label: dim.dimension, actions: ["Consulte o framework DMBoK 2.0 para esta dimensão."] };
    const level =
      dim.score >= 80 ? "ótimo" :
      dim.score >= 60 ? "bom" :
      dim.score >= 40 ? "atenção" : "crítico";

    // Filtra ações apenas para dimensões abaixo de 80
    if (dim.score < 80) {
      recommendations.push({
        dimension: meta.label,
        level,
        score: dim.score,
        framework: "DMBoK 2.0",
        actions: meta.actions,
      });
    }
  }

  // Ordena: crítico primeiro
  recommendations.sort((a, b) => a.score - b.score);

  return {
    overallScore: (score as any)?.overall ?? 0,
    totalRecommendations: recommendations.length,
    recommendations,
    certificationReadiness: {
      dcam: recommendations.filter(r => r.level === "crítico").length === 0 ? "Elegível" : "Não elegível",
      iso8000: (score as any)?.overall >= 70 ? "Preparação avançada" : "Preparação inicial",
      notes: "Baseado nos critérios públicos DMBoK 2.0 e DCAM 2.0 — validar com assessor certificado.",
    },
  };
}

const maturityRouter = router({
  score: protectedProcedure.query(() => db.getMaturityScore()),
  drilldown: protectedProcedure.query(() => db.getMaturityDrilldown()),
  lgpdAssets: protectedProcedure.query(() => db.getLgpdAssets()),
  domainQuality: protectedProcedure.query(() => db.getDomainQualityTrend()),
  recommendations: protectedProcedure.query(async () => {
    const score = await db.getMaturityScore();
    return generateDMBoKRecommendations(score);
  }),
});

// ─── Data Contracts Router ────────────────────────────────────────────────────
const dataContractsRouter = router({
  list: protectedProcedure
    .input(z.object({
      assetId: z.number().optional(),
      status: z.string().optional(),
    }).optional())
    .query(({ input }) => db.getDataContracts(input ?? {})),
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => db.getDataContractById(input.id)),
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(256),
      assetId: z.number(),
      producerTeam: z.string().max(256).optional().nullable(),
      consumerTeam: z.string().max(256).optional().nullable(),
      description: z.string().optional().nullable(),
      slaLevel: z.string().max(64).optional().nullable(),
      schemaJson: z.any().optional().nullable(),
      deliveryFrequency: z.string().max(64).optional().nullable(),
      version: z.string().max(32).optional(),
      status: z.enum(['rascunho', 'em_revisao', 'ativo', 'expirado', 'cancelado']).optional(),
      signedAt: z.string().optional().nullable(),
      expiresAt: z.string().optional().nullable(),
      changeNotes: z.string().optional().nullable(),
    }))
    .mutation(({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: 'UNAUTHORIZED' });
      return db.createDataContract({
        ...input,
        createdById: ctx.user.id,
        createdByName: ctx.user.name,
        signedAt: input.signedAt ? new Date(input.signedAt) : null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      } as any);
    }),
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(256).optional(),
      assetId: z.number().optional().nullable(),
      producerTeam: z.string().max(256).optional().nullable(),
      consumerTeam: z.string().max(256).optional().nullable(),
      description: z.string().optional().nullable(),
      slaLevel: z.string().max(64).optional().nullable(),
      schemaJson: z.any().optional().nullable(),
      deliveryFrequency: z.string().max(64).optional().nullable(),
      version: z.string().max(32).optional(),
      status: z.enum(['rascunho', 'em_revisao', 'ativo', 'expirado', 'cancelado']).optional(),
      signedAt: z.string().optional().nullable(),
      expiresAt: z.string().optional().nullable(),
      approvedById: z.number().optional().nullable(),
      approvedByName: z.string().optional().nullable(),
      changeNotes: z.string().optional().nullable(),
    }))
    .mutation(({ input }) => {
      const { id, signedAt, expiresAt, ...rest } = input;
      return db.updateDataContract(id, {
        ...rest,
        signedAt: signedAt ? new Date(signedAt) : (signedAt === null ? null : undefined),
        expiresAt: expiresAt ? new Date(expiresAt) : (expiresAt === null ? null : undefined),
      } as any);
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input, ctx }) => {
      if (ctx.user?.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
      return db.deleteDataContract(input.id);
    }),
});

// ─── PIA / DPIA Assessments Router ───────────────────────────────────────────
const piaRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      riskLevel: z.string().optional(),
    }).optional())
    .query(({ input }) => db.getPiaAssessments(input ?? {})),
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => db.getPiaAssessmentById(input.id)),
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(256),
      assetId: z.number().optional().nullable(),
      assetName: z.string().optional().nullable(),
      status: z.enum(["rascunho", "em_revisao", "aprovado", "rejeitado"]).optional(),
      riskLevel: z.enum(["baixo", "medio", "alto", "critico"]).optional().nullable(),
      dataCategories: z.any().optional().nullable(),
      purposes: z.string().optional().nullable(),
      legalBasis: z.string().optional().nullable(),
      retentionPeriod: z.string().optional().nullable(),
      crossBorderTransfer: z.boolean().optional(),
      thirdPartySharing: z.boolean().optional(),
      automatedDecision: z.boolean().optional(),
      mitigationMeasures: z.string().optional().nullable(),
      residualRisk: z.string().optional().nullable(),
      dpoRecommendation: z.string().optional().nullable(),
      reviewNotes: z.string().optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const result = await db.createPiaAssessment({
        ...input,
        createdById: ctx.user.id,
        createdByName: ctx.user.name,
      } as any);

      // Audit Log for PIA Creation
      await db.createAuditLog({
        userId: ctx.user.id,
        userEmail: ctx.user.email,
        userName: ctx.user.name,
        action: "create",
        entity: "pia_assessment",
        entityId: (result as any).id,
        entityName: input.title,
        details: { assetId: input.assetId, riskLevel: input.riskLevel },
        ipAddress: ctx.req?.ip,
      });

      return result;
    }),
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).max(256).optional(),
      assetId: z.number().optional().nullable(),
      assetName: z.string().optional().nullable(),
      status: z.enum(["rascunho", "em_revisao", "aprovado", "rejeitado"]).optional(),
      riskLevel: z.enum(["baixo", "medio", "alto", "critico"]).optional().nullable(),
      dataCategories: z.any().optional().nullable(),
      purposes: z.string().optional().nullable(),
      legalBasis: z.string().optional().nullable(),
      retentionPeriod: z.string().optional().nullable(),
      crossBorderTransfer: z.boolean().optional(),
      thirdPartySharing: z.boolean().optional(),
      automatedDecision: z.boolean().optional(),
      mitigationMeasures: z.string().optional().nullable(),
      residualRisk: z.string().optional().nullable(),
      dpoRecommendation: z.string().optional().nullable(),
      reviewedByName: z.string().optional().nullable(),
      reviewNotes: z.string().optional().nullable(),
    }))
    .mutation(({ input, ctx }) => {
      const { id, ...rest } = input;
      const patch: Record<string, any> = { ...rest };
      if (rest.status === "aprovado" && ctx.user?.id) {
        patch.reviewedById = ctx.user.id;
        patch.reviewedByName = ctx.user.name;
        patch.approvedAt = new Date();
      }
      return db.updatePiaAssessment(id, patch as any);
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input, ctx }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return db.deletePiaAssessment(input.id);
    }),
});

// ─── DSAR — Data Subject Access Requests Router ───────────────────────────────
const dsarRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      requestType: z.string().optional(),
    }).optional())
    .query(({ input }) => db.getDsarRequests(input ?? {})),
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => db.getDsarRequestById(input.id)),
  create: protectedProcedure
    .input(z.object({
      requestType: z.enum(["acesso","retificacao","exclusao","portabilidade","oposicao","revogacao_consentimento"]),
      subjectName: z.string().min(1).max(256),
      subjectEmail: z.string().email().max(320),
      subjectDocument: z.string().max(64).optional().nullable(),
      description: z.string().optional().nullable(),
      assignedToId: z.number().optional().nullable(),
      assignedToName: z.string().optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 15); // LGPD art. 19 — Ajustado para 15 dias (prazo regulamentar comum)
      const result = await db.createDsarRequest({
        ...input,
        status: "aberto",
        deadline,
      } as any);

      // Audit Log for DSAR Creation
      if (ctx.user) {
        await db.createAuditLog({
          userId: ctx.user.id,
          userEmail: ctx.user.email,
          userName: ctx.user.name,
          action: "create",
          entity: "dsar_request",
          entityId: (result as any).id,
          entityName: `${input.requestType} - ${input.subjectName}`,
          details: { requestType: input.requestType, subjectEmail: input.subjectEmail },
          ipAddress: ctx.req?.ip,
        });
      }

      return result;
    }),
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["aberto","em_andamento","concluido","rejeitado"]).optional(),
      internalNotes: z.string().optional().nullable(),
      responseDetails: z.string().optional().nullable(),
      assignedToId: z.number().optional().nullable(),
      assignedToName: z.string().optional().nullable(),
      subjectName: z.string().optional(),
      subjectEmail: z.string().email().optional(),
      subjectDocument: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
    }))
    .mutation(({ input }) => {
      const { id, ...rest } = input;
      const patch: Record<string, any> = { ...rest };
      if (rest.status === "concluido" || rest.status === "rejeitado") {
        patch.closedAt = new Date();
      }
      return db.updateDsarRequest(id, patch as any);
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input, ctx }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return db.deleteDsarRequest(input.id);
    }),
});

// ─── Connectors Router (Marketplace) ─────────────────────────────────────────
const CONNECTOR_CATALOG = [
  { type: "portal",      name: "Portal (interno)",        description: "Analisa qualidade dos metadados do catálogo interno.", category: "database", icon: "🏛️" },
  { type: "mysql",       name: "MySQL / MariaDB",          description: "Conecta a bancos MySQL e MariaDB via URL de conexão.", category: "database", icon: "🐬" },
  { type: "postgresql",  name: "PostgreSQL",               description: "Conecta a bancos PostgreSQL via URL de conexão.",     category: "database", icon: "🐘" },
  { type: "mssql",       name: "SQL Server",               description: "Integração com Microsoft SQL Server.",               category: "database", icon: "🪟" },
  { type: "oracle",      name: "Oracle DB",                description: "Conecta a bancos Oracle via JDBC/ODBC.",             category: "database", icon: "🔴" },
  { type: "sap_hana",   name: "SAP HANA",                  description: "Integração com SAP HANA para coleta de metadados.",  category: "database", icon: "🟡" },
  { type: "mongodb",    name: "MongoDB",                   description: "Cataloga coleções MongoDB como ativos.",             category: "nosql",    icon: "🍃" },
  { type: "snowflake",  name: "Snowflake",                 description: "Conecta ao Snowflake Data Cloud.",                  category: "cloud",    icon: "❄️" },
  { type: "bigquery",   name: "BigQuery",                  description: "Cataloga datasets e tabelas do Google BigQuery.",    category: "cloud",    icon: "☁️" },
  { type: "databricks", name: "Databricks",                description: "Conecta ao Databricks Lakehouse Platform.",         category: "cloud",    icon: "🧱" },
  { type: "s3",         name: "Amazon S3 / MinIO",         description: "Cataloga objetos de buckets S3 como ativos.",       category: "cloud",    icon: "🪣" },
  { type: "dbt",        name: "dbt (manifest.json)",       description: "Importa lineagem automática de projetos dbt.",      category: "etl",      icon: "🔧" },
  { type: "airflow",    name: "Apache Airflow",            description: "Extrai lineagem de DAGs do Airflow.",               category: "etl",      icon: "💨" },
  { type: "power_bi",  name: "Power BI",                   description: "Importa relatórios e datasets do Power BI.",        category: "bi",       icon: "📊" },
  { type: "tableau",   name: "Tableau",                    description: "Cataloga workbooks e data sources do Tableau.",     category: "bi",       icon: "📈" },
  { type: "rest_api",  name: "REST API genérica",          description: "Conecta a qualquer API REST como fonte de dados.",  category: "api",      icon: "🔌" },
] as const;

/**
 * Detecta linhagem automaticamente por convenção de nomenclatura de camadas Databricks.
 * Ex: bronze.tabela → silver.tabela → gold.tabela
 */
function detectDatabricksLineage(tableNames: string[]): Array<{
  sourceName: string; targetName: string;
  type: "direto" | "transformado" | "agregado"; transformationRule?: string;
}> {
  const edges: Array<{ sourceName: string; targetName: string; type: "direto" | "transformado" | "agregado"; transformationRule?: string }> = [];
  const nameSet = new Set(tableNames.map(n => n.toLowerCase()));

  const LAYER_PAIRS: Array<[string, string, "direto" | "transformado" | "agregado"]> = [
    ["bronze", "silver", "transformado"],
    ["raw",    "refined", "transformado"],
    ["raw",    "trusted", "transformado"],
    ["silver", "gold",   "agregado"],
    ["refined","gold",   "agregado"],
    ["trusted","gold",   "agregado"],
    ["silver", "platinum","agregado"],
  ];

  for (const tableName of tableNames) {
    const parts = tableName.split(".");
    if (parts.length < 2) continue;
    const schema = parts[0].toLowerCase();
    const table  = parts.slice(1).join(".");

    for (const [src, tgt, edgeType] of LAYER_PAIRS) {
      if (schema === tgt) {
        const candidateSource = `${src}.${table}`;
        if (nameSet.has(candidateSource.toLowerCase())) {
          edges.push({
            sourceName: candidateSource,
            targetName: tableName,
            type: edgeType,
            transformationRule: `Transformação automática ${src} → ${tgt}`,
          });
        }
      }
    }
  }

  // Detecção de Dimensão → Fato no mesmo Schema/Domínio (Estrela / Snowflake)
  for (const tableName of tableNames) {
    const parts = tableName.split(".");
    if (parts.length < 2) continue;
    const schema = parts[0].toLowerCase();
    const table = parts.slice(1).join(".").toLowerCase();

    if (table.startsWith("fato_") || table.startsWith("fact_")) {
      for (const candidateName of tableNames) {
        const cParts = candidateName.split(".");
        if (cParts.length < 2) continue;
        const cSchema = cParts[0].toLowerCase();
        const cTable = cParts.slice(1).join(".").toLowerCase();

        if (cSchema === schema && (cTable.startsWith("dim_") || cTable === "fornecedor" || cTable === "remessa_categoria")) {
          edges.push({
            sourceName: candidateName,
            targetName: tableName,
            type: "direto",
            transformationRule: `Associação automática estrela (${cTable} → ${table})`,
          });
        }
      }
    }
  }

  return edges;
}

const connectorsRouter = router({
  catalog: protectedProcedure.query(() => CONNECTOR_CATALOG),

  list: protectedProcedure.query(() => db.getConnectorConfigs()),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => db.getConnectorConfigById(input.id)),

  create: protectedProcedure
    .input(z.object({
      connectorType: z.string(),
      name: z.string().min(1),
      configJson: z.object({}).catchall(z.unknown()),
      active: z.boolean().optional(),
    }))
    .mutation(({ input, ctx }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return db.createConnectorConfig({
        connectorType: input.connectorType,
        name: input.name,
        configJson: input.configJson,
        active: input.active ?? true,
        createdById: ctx.user.id,
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      configJson: z.object({}).catchall(z.unknown()).optional(),
      active: z.boolean().optional(),
    }))
    .mutation(({ input, ctx }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { id, ...rest } = input;
      return db.updateConnectorConfig(id, rest);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input, ctx }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return db.deleteConnectorConfig(input.id);
    }),

  test: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const config = await db.getConnectorConfigById(input.id);
      if (!config) throw new TRPCError({ code: "NOT_FOUND" });
      try {
        const rawCfg = typeof config.configJson === 'string' ? JSON.parse(config.configJson) : config.configJson as Record<string, any>;

        // Para Databricks: resolve o token via Scope API, AKV ou direto (todos os modos)
        if (config.connectorType?.toLowerCase().includes("databricks")) {
          const resolvedToken = await resolveDatabricksToken(rawCfg);
          if (!resolvedToken) {
            const hint = rawCfg.authMode === "scope"
              ? `Verifique o Bootstrap Token e se o scope "${rawCfg.scopeName}" / key "${rawCfg.secretKey}" existem.`
              : rawCfg.authMode === "akv"
              ? "Verifique a URL do vault, nome do segredo e as permissões do Service Principal."
              : "Preencha o campo Token (PAT).";
            await db.saveConnectorTestResult(input.id, false, `Token não resolvido. ${hint}`);
            return { success: false, message: `Token não resolvido — ${hint}` };
          }
          const adapter = new DatabricksAdapter({
            host: rawCfg.host,
            httpPath: rawCfg.httpPath,
            token: resolvedToken,
            catalog: rawCfg.catalog,
          }, config.name);
          const testRes = await adapter.testConnection();
          const modeLabel = rawCfg.authMode === "scope" ? `Secret Scope "${rawCfg.scopeName}"` : rawCfg.authMode === "akv" ? "AKV" : rawCfg.authMode === "entra_id" ? "Entra ID (CLI)" : "PAT";
          const msg = testRes.ok
            ? `Conexão bem-sucedida (token via ${modeLabel})`
            : `Falha ao conectar ao Databricks (modo: ${modeLabel}) - ERRO: ${testRes.message}`;
          await db.saveConnectorTestResult(input.id, testRes.ok, msg);
          return { success: testRes.ok, message: msg };
        }

        // Fluxo padrão para todos os outros tipos de conector
        const { getAdapter } = await import("./adapters/index.js");
        const adapter = getAdapter(config.connectorType);
        if (!adapter) {
          await db.saveConnectorTestResult(input.id, false, "Adaptador não encontrado para este tipo de conector.");
          return { success: false, message: "Adaptador não encontrado." };
        }
        const ok = await adapter.testConnection();
        const msg = ok ? "Conexão bem-sucedida" : "Falha ao conectar";
        await db.saveConnectorTestResult(input.id, ok, msg);
        return { success: ok, message: msg };
      } catch (err: any) {
        const msg = err?.message ?? "Erro desconhecido";
        await db.saveConnectorTestResult(input.id, false, msg);
        return { success: false, message: msg };
      }
    }),

  sync: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const config = await db.getConnectorConfigById(input.id);
      if (!config) throw new TRPCError({ code: "NOT_FOUND" });
      try {
        const { metadataCollector } = await import("./metadataCollector.js");
        const rawCfg = typeof config.configJson === 'string' ? JSON.parse(config.configJson) : config.configJson as Record<string, any>;
        const type = config.connectorType?.toLowerCase() ?? "";

        // Para Databricks: resolve token via Scope API, AKV ou direto (todos os modos)
        let cfg = { ...rawCfg };
        if (type.includes("databricks")) {
          const resolvedToken = await resolveDatabricksToken(rawCfg);
          if (!resolvedToken) {
            return {
              success: false,
              message: rawCfg.authMode === "scope"
                ? `Não foi possível obter o token via Databricks Secret Scope. Verifique scope "${rawCfg.scopeName}", key "${rawCfg.secretKey}" e o Bootstrap Token.`
                : rawCfg.authMode === "akv"
                ? "Não foi possível obter o token do Azure Key Vault. Verifique a URL do vault e o nome do segredo."
                : "Token não configurado. Preencha o campo Token (PAT).",
              assetsFound: 0,
            };
          }
          cfg = { ...cfg, token: resolvedToken };
          console.log(`[sync] Token Databricks resolvido via authMode="${rawCfg.authMode}".`);
        }

        let result;
        if (type.includes("databricks"))        result = await metadataCollector.crawlDatabricks(cfg);
        else if (type.includes("snowflake"))    result = await metadataCollector.crawlSnowflake(cfg);
        else if (type.includes("bigquery"))     result = await metadataCollector.crawlBigQuery(cfg);
        else if (type.includes("postgres"))     result = await metadataCollector.crawlPostgres(cfg);
        else if (type.includes("sap"))          result = await metadataCollector.crawlSAPHana(cfg);
        else {
          return { success: false, message: "Tipo de conector sem crawler disponível.", assetsFound: 0 };
        }
        // Persiste os ativos — syncAll já resolve o token internamente para todos os conectores
        await metadataCollector.syncAll();


        // Detecta linhagem automática por padrão de camadas (bronze→silver→gold)
        if (result.tables.length > 0) {
          const lineageEdges = detectDatabricksLineage(result.tables.map(t => t.name));
          if (lineageEdges.length > 0) {
            await db.importLineageEdges(lineageEdges).catch(() => {/* ignora erros de duplicata */});
          }
        }

        // Dispara quality checks em background sem bloquear a resposta
        const { qualityEngine } = await import("./qualityEngine.js");
        qualityEngine.runGlobalQualityCheck().catch(e => console.error("[sync] quality check falhou:", e));
        await db.updateConnectorConfig(config.id, {
          lastTestedAt: new Date(),
          lastTestSuccess: result.connectorUsed === "real",
          lastTestMessage: result.errors.length > 0 ? result.errors[0] : `${result.tables.length} ativos sincronizados`,
        });
        return { success: true, message: `${result.tables.length} ativos encontrados e sincronizados.`, assetsFound: result.tables.length };
      } catch (err: any) {
        return { success: false, message: err?.message ?? "Erro ao sincronizar", assetsFound: 0 };
      }
    }),
});

// ─── Workflow Router ──────────────────────────────────────────────────────────
const workflowRouter = router({
  // Definições
  listDefinitions: protectedProcedure
    .input(z.object({ orgId: z.number().optional() }))
    .query(({ input }) => db.getWorkflowDefinitions(input.orgId)),

  getDefinition: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => db.getWorkflowDefinitionById(input.id)),

  createDefinition: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      name: z.string().min(1),
      description: z.string().optional(),
      stepsJson: z.array(z.object({
        id: z.string(),
        type: z.enum(["approval", "parallel_approval", "notification"]),
        label: z.string(),
        approvers: z.array(z.string()).optional(),
        parallelAll: z.boolean().optional(),
        notifyEmails: z.array(z.string()).optional(),
      })),
      triggerEntityType: z.string().default("asset"),
      autoTrigger: z.boolean().default(false),
      active: z.boolean().default(true),
    }))
    .mutation(({ input }) => db.createWorkflowDefinition(input as any)),

  updateDefinition: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      stepsJson: z.array(z.any()).optional(),
      active: z.boolean().optional(),
    }))
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return db.updateWorkflowDefinition(id, data as any);
    }),

  deleteDefinition: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => db.deleteWorkflowDefinition(input.id)),

  // Instâncias
  listInstances: protectedProcedure
    .input(z.object({
      entityType: z.string().optional(),
      entityId: z.number().optional(),
      status: z.string().optional(),
    }))
    .query(({ input }) => db.getWorkflowInstances(input)),

  getInstance: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const inst = await db.getWorkflowInstanceById(input.id);
      if (!inst) return null;
      const def = await db.getWorkflowDefinitionById(inst.definitionId);
      const actions = await db.getWorkflowStepActions(input.id);
      return { ...inst, definition: def, actions };
    }),

  trigger: protectedProcedure
    .input(z.object({
      definitionId: z.number(),
      entityType: z.string(),
      entityId: z.number(),
      context: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(({ input, ctx }) =>
      triggerWorkflow({
        definitionId: input.definitionId,
        entityType: input.entityType,
        entityId: input.entityId,
        initiatorOpenId: ctx.user!.openId,
        context: input.context,
      })
    ),

  // Tarefas pendentes do usuário logado
  myTasks: protectedProcedure
    .query(({ ctx }) => db.getMyWorkflowTasks(ctx.user!.openId)),

  // Decisão (aprovar/rejeitar)
  decide: protectedProcedure
    .input(z.object({
      instanceId: z.number(),
      decision: z.enum(["approved", "rejected", "delegated", "commented"]),
      comment: z.string().optional(),
    }))
    .mutation(({ input, ctx }) =>
      recordDecision({
        instanceId: input.instanceId,
        actorOpenId: ctx.user!.openId,
        actorName: ctx.user!.name ?? undefined,
        decision: input.decision,
        comment: input.comment,
      })
    ),

  cancel: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => cancelWorkflow(input.id)),
});

// ─── Asset Comments Router ────────────────────────────────────────────────────
const assetCommentsRouter = router({
  list: protectedProcedure
    .input(z.object({ assetId: z.number() }))
    .query(({ input }) => db.getAssetComments(input.assetId)),

  create: protectedProcedure
    .input(z.object({
      assetId: z.number(),
      content: z.string().min(1).max(4000),
      parentId: z.number().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const user = ctx.user as { id: number; name?: string; email?: string } | undefined;
      if (!user) throw new Error("Não autenticado");
      return db.createAssetComment({
        assetId: input.assetId,
        userId: user.id,
        userName: user.name ?? user.email ?? "Usuário",
        content: input.content,
        parentId: input.parentId ?? null,
      });
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), content: z.string().min(1).max(4000) }))
    .mutation(({ ctx, input }) => {
      const user = ctx.user as { id: number } | undefined;
      if (!user) throw new Error("Não autenticado");
      return db.updateAssetComment(input.id, user.id, input.content);
    }),

  resolve: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => db.resolveAssetComment(input.id)),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => {
      const user = ctx.user as { id: number } | undefined;
      if (!user) throw new Error("Não autenticado");
      return db.deleteAssetComment(input.id, user.id);
    }),
});

// ─── Intake de Demandas Router ────────────────────────────────────────────────
const intakeRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      domainId: z.number().optional(),
      priority: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }).optional())
    .query(({ input, ctx }) => {
      // Usuários comuns só veem as próprias demandas
      const isPrivileged = ["admin", "data_owner", "data_steward"].includes(ctx.user?.role ?? "");
      return db.getIntakeRequests({
        ...input,
        submittedById: isPrivileged ? undefined : ctx.user?.id,
      });
    }),

  myRequests: protectedProcedure
    .query(({ ctx }) => db.getIntakeRequests({ submittedById: ctx.user?.id })),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => db.getIntakeRequestById(input.id)),

  create: protectedProcedure
    .input(z.object({
      // A — Identificação
      title: z.string().min(3).max(256),
      description: z.string().min(1),
      type: z.enum(["dado", "projeto_ia", "compliance", "qualidade", "acesso", "outro"]),
      priority: z.enum(["baixa", "media", "alta", "critica"]).default("media"),
      desiredDeadline: z.string().optional(),
      submitterDept: z.string().optional(),
      domainId: z.number().optional(),
      assetId: z.number().optional(),
      managerApproval: z.string().optional(),
      // B — Caso de Uso
      problemStatement: z.string().optional(),
      objective: z.string().optional(),
      targetAudience: z.string().optional(),
      usageFrequency: z.string().optional(),
      financialImpact: z.string().optional(),
      businessImpact: z.string().optional(),
      technicalImpact: z.string().optional(),
      // C — Dados
      sourceSystems: z.string().optional(),
      mainEntities: z.string().optional(),
      estimatedVolume: z.string().optional(),
      updateFrequency: z.string().optional(),
      historyNeeded: z.string().optional(),
      containsPii: z.enum(["sim", "nao", "nao_sei"]).optional(),
      piiColumns: z.string().optional(),
      expectedFields: z.string().optional(),
      // D — Qualidade
      qualityCriteria: z.array(z.object({
        dimension: z.string(), affectedField: z.string(),
        rule: z.string(), blocksPipeline: z.boolean(),
      })).optional(),
      minDqScore: z.number().optional(),
      dqFailAction: z.string().optional(),
      // E — Sucesso
      successCriteria: z.array(z.object({
        criterion: z.string(), kpi: z.string(), goal: z.string(),
      })).optional(),
      postDeliveryMeasurement: z.string().optional(),
      // F — Governança
      dataOwnerName: z.string().optional(),
      dataStewardName: z.string().optional(),
      privacyChampion: z.string().optional(),
      dataSensitivity: z.enum(["publico", "interno", "confidencial", "restrito"]).optional(),
      accessGroups: z.string().optional(),
      applicableRegulations: z.string().optional(),
      retentionPeriod: z.string().optional(),
      // G — Riscos
      technicalDependencies: z.string().optional(),
      identifiedRisks: z.string().optional(),
      relatedDemands: z.string().optional(),
      testEnvironmentAvailable: z.string().optional(),
      networkInfraNeeded: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const intakeCode = await db.generateIntakeCode();

      const result = await db.createIntakeRequest({
        ...input,
        intakeCode,
        submittedById: ctx.user!.id,
        submitterName: ctx.user!.name ?? ctx.user!.email ?? "Usuário",
        submitterEmail: ctx.user!.email ?? undefined,
        status: "submetido",
      } as any);
      await db.createAuditLog({
        userId: ctx.user?.id, userEmail: ctx.user?.email, userName: ctx.user?.name,
        action: "create", entity: "intake_request", entityName: input.title,
        details: { type: input.type, priority: input.priority, intakeCode },
        ipAddress: ctx.req?.ip,
      });
      return { ...result, intakeCode };
    }),

  // Triagem: admin/steward/owner decide o destino + scoring P1-P4
  triage: protectedProcedure
    .use(({ ctx, next }) => {
      if (!["admin", "data_owner", "data_steward"].includes(ctx.user?.role ?? "")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas membros do comitê podem triar demandas." });
      }
      return next({ ctx });
    })
    .input(z.object({
      id: z.number(),
      decision: z.enum(["aprovado_estrategico", "aprovado_operacional", "retornado", "rejeitado"]),
      reviewNotes: z.string().optional(),
      returnReason: z.string().optional(),
      meetingId: z.number().optional(),
      // Scoring legado (1–5)
      impactScore: z.number().min(1).max(5).optional(),
      effortScore: z.number().min(1).max(5).optional(),
      scoringNotes: z.string().optional(),
      // Scoring P1-P4 (1=baixo, 2=médio, 3=alto)
      scoreFinancialImpact:      z.number().min(1).max(3).optional(),
      scoreBusinessUrgency:      z.number().min(1).max(3).optional(),
      scoreReach:                z.number().min(1).max(3).optional(),
      scoreStrategicAlignment:   z.number().min(1).max(3).optional(),
      scoreIntakeCompleteness:   z.number().min(1).max(3).optional(),
      scoreTechnicalFeasibility: z.number().min(1).max(3).optional(),
      scoreReuse:                z.number().min(1).max(3).optional(),
      scoreDataOwnerDefined:     z.number().min(1).max(3).optional(),
      // Checklist de triagem
      triageChecklist: z.object({
        completeness: z.array(z.boolean()).length(6),
        viability:    z.array(z.boolean()).length(5),
        governance:   z.array(z.boolean()).length(4),
        result: z.enum(["aprovado", "devolvido", "recusado"]).optional(),
      }).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const intake = await db.getIntakeRequestById(input.id);
      if (!intake) throw new TRPCError({ code: "NOT_FOUND" });

      // Calcular totalScore e priorityTier se scores P1-P4 fornecidos
      const weights = { scoreFinancialImpact: 10, scoreBusinessUrgency: 10, scoreReach: 8,
        scoreStrategicAlignment: 8, scoreIntakeCompleteness: 6, scoreTechnicalFeasibility: 5,
        scoreReuse: 4, scoreDataOwnerDefined: 4 };
      let totalScore: number | null = null;
      let priorityTier: "P1" | "P2" | "P3" | "P4" | null = null;
      const hasAllScores = (["scoreFinancialImpact","scoreBusinessUrgency","scoreReach",
        "scoreStrategicAlignment","scoreIntakeCompleteness","scoreTechnicalFeasibility",
        "scoreReuse","scoreDataOwnerDefined"] as const).every(k => input[k] != null);
      if (hasAllScores) {
        totalScore = Object.entries(weights).reduce((acc, [k, w]) =>
          acc + ((input as any)[k] - 1) * (w / 2), 0);
        // normalizar para 0-100: máx real = soma de (3-1)*w/2 para todos
        const maxRaw = Object.values(weights).reduce((a, w) => a + w, 0);
        totalScore = Math.round((totalScore / maxRaw) * 100);
        priorityTier = totalScore >= 85 ? "P1" : totalScore >= 70 ? "P2" : totalScore >= 60 ? "P3" : "P4";
      }

      const updateData: any = {
        status: input.decision,
        reviewedById: ctx.user!.id,
        reviewedByName: ctx.user!.name ?? ctx.user!.email,
        reviewedAt: new Date(),
        reviewNotes: input.reviewNotes ?? null,
        returnReason: input.returnReason ?? null,
        impactScore: input.impactScore ?? null,
        effortScore: input.effortScore ?? null,
        scoringNotes: input.scoringNotes ?? null,
        scoreFinancialImpact:      input.scoreFinancialImpact ?? null,
        scoreBusinessUrgency:      input.scoreBusinessUrgency ?? null,
        scoreReach:                input.scoreReach ?? null,
        scoreStrategicAlignment:   input.scoreStrategicAlignment ?? null,
        scoreIntakeCompleteness:   input.scoreIntakeCompleteness ?? null,
        scoreTechnicalFeasibility: input.scoreTechnicalFeasibility ?? null,
        scoreReuse:                input.scoreReuse ?? null,
        scoreDataOwnerDefined:     input.scoreDataOwnerDefined ?? null,
        totalScore,
        priorityTier,
        triageChecklist: input.triageChecklist ?? null,
      };

      if (input.decision === "aprovado_estrategico" && input.meetingId) {
        const agendaItem = await db.createAgendaItem({
          meetingId: input.meetingId,
          title: `[Intake] ${intake.title}`,
          description: intake.description,
          duration: 15,
        });
        updateData.relatedMeetingId = input.meetingId;
        updateData.agendaItemId = (agendaItem as any).insertId ?? null;
      }

      await db.updateIntakeRequest(input.id, updateData);
      await db.createAuditLog({
        userId: ctx.user?.id, userEmail: ctx.user?.email, userName: ctx.user?.name,
        action: "update" as any, entity: "intake_request", entityId: input.id,
        details: { decision: input.decision, totalScore, priorityTier },
        ipAddress: ctx.req?.ip,
      });
      return { success: true, decision: input.decision, totalScore, priorityTier };
    }),

  // Ranking: demandas pontuadas ordenadas por prioridade
  ranking: protectedProcedure
    .query(() => db.getIntakeRanking()),

  // Iniciar execução (qualquer membro privilegiado)
  startExecution: protectedProcedure
    .use(({ ctx, next }) => {
      if (!["admin", "data_owner", "data_steward"].includes(ctx.user?.role ?? "")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return next({ ctx });
    })
    .input(z.object({
      id: z.number(),
      executionNotes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await db.startIntakeExecution(input.id, {
        executorId: ctx.user!.id,
        executorName: ctx.user!.name ?? ctx.user!.email ?? "—",
        executionNotes: input.executionNotes,
      });
      return { success: true };
    }),

  // Marcar como entregue
  deliver: protectedProcedure
    .use(({ ctx, next }) => {
      if (!["admin", "data_owner", "data_steward"].includes(ctx.user?.role ?? "")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return next({ ctx });
    })
    .input(z.object({
      id: z.number(),
      deliveryNotes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await db.deliverIntake(input.id, { deliveryNotes: input.deliveryNotes });
      return { success: true };
    }),

  // Validar entrega (Data Owner / admin)
  validate: protectedProcedure
    .use(({ ctx, next }) => {
      if (!["admin", "data_owner"].includes(ctx.user?.role ?? "")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Data Owner ou Admin podem validar a entrega." });
      }
      return next({ ctx });
    })
    .input(z.object({
      id: z.number(),
      deliveryNotes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await db.validateIntake(input.id, {
        validatedById: ctx.user!.id,
        validatedByName: ctx.user!.name ?? ctx.user!.email ?? "—",
        deliveryNotes: input.deliveryNotes,
      });
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => db.deleteIntakeRequest(input.id)),

  counts: protectedProcedure
    .query(async () => {
      const [submetido, em_triagem, aprovado_estrategico, aprovado_operacional, retornado, rejeitado, em_execucao, concluido] = await Promise.all([
        db.countIntakeRequests({ status: "submetido" }),
        db.countIntakeRequests({ status: "em_triagem" }),
        db.countIntakeRequests({ status: "aprovado_estrategico" }),
        db.countIntakeRequests({ status: "aprovado_operacional" }),
        db.countIntakeRequests({ status: "retornado" }),
        db.countIntakeRequests({ status: "rejeitado" }),
        db.countIntakeRequests({ status: "em_execucao" }),
        db.countIntakeRequests({ status: "concluido" }),
      ]);
      return { submetido, em_triagem, aprovado_estrategico, aprovado_operacional, retornado, rejeitado, em_execucao, concluido };
    }),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  domains: domainsRouter,
  participants: participantsRouter,
  meetings: meetingsRouter,
  invites: invitesRouter,
  raci: raciRouter,
  implementation: implementationRouter,
  ai: aiRouter,
  servicenow: servicenowRouter,
  metrics: metricsRouter,
  notifications: notificationsRouter,
  export: exportRouter,
  roles: rolesRouter,
  teams: teamsRouter,
  ticketAlertConfigs: ticketAlertConfigsRouter,
  settings: settingsRouter,
  feedback: feedbackRouter,
  governance: governanceRouter,
  accessRequests: accessRequestsRouter,
  auditLog: auditLogRouter,
  glossary: glossaryRouter,
  organizations: organizationsRouter,
  sla: slaRouter,
  webhooks: webhooksRouter,
  sso: ssoRouter,
  apiKeys: apiKeysRouter,
  maturity: maturityRouter,
  dataContracts: dataContractsRouter,
  pia: piaRouter,
  dsar: dsarRouter,
  connectors: connectorsRouter,
  workflow: workflowRouter,
  assetComments: assetCommentsRouter,
  intake: intakeRouter,
  // ─── Lacunas Lucid Data Governance ───────────────────────────────────────────
  mlops: mlopsRouter,
  aiRisk: aiRiskRouter,
  aiPipeline: aiPipelineRouter,
  biConnectors: biConnectorsRouter,
  auditoria: auditoriaRouter,
  hub: hubRouter,
});
export type AppRouter = typeof appRouter;


// Force reload 1777552024634