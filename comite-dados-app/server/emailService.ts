import nodemailer from "nodemailer";
import * as db from "./db";
import { emailNotifications } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// ─── Transporter ──────────────────────────────────────────────────────────────
// ─── Transporter ──────────────────────────────────────────────────────────────
async function createTransporter() {
  const [dbHost, dbPort, dbUser, dbPass, dbSecure] = await Promise.all([
    db.getSystemSetting("SMTP_HOST"),
    db.getSystemSetting("SMTP_PORT"),
    db.getSystemSetting("SMTP_USER"),
    db.getSystemSetting("SMTP_PASS"),
    db.getSystemSetting("SMTP_SECURE"),
  ]);

  const host = dbHost || process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(dbPort || process.env.SMTP_PORT || "587");
  const user = dbUser || process.env.SMTP_USER;
  const pass = dbPass || process.env.SMTP_PASS;
  // Se SMTP_SECURE não estiver no banco, usa o padrão baseado na porta
  const secure = dbSecure !== null ? dbSecure === "true" : port === 465;

  if (!user || !pass) {
    console.warn("[Email] SMTP credentials not configured — running in simulation mode");
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { 
      rejectUnauthorized: process.env.NODE_ENV === "production",
    },
    // Para porta 587 (STARTTLS), force a negociação segura
    requireTLS: port === 587,
  });
}


// ─── Base HTML Template ───────────────────────────────────────────────────────
function baseTemplate(content: string, previewText = ""): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Lucid Data Governance</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#F4F6FA;font-family:'Segoe UI',Arial,sans-serif;">
  ${previewText ? `<div style="display:none;max-height:0;overflow:hidden;">${previewText}</div>` : ""}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6FA;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- HEADER -->
        <tr>
          <td style="background:#1B3A8C;border-radius:8px 8px 0 0;padding:28px 36px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="color:#FFFFFF;font-size:20px;font-weight:700;letter-spacing:0.5px;">
                    Lucid Data Governance
                  </div>
                  <div style="color:#6DC23A;font-size:13px;font-weight:600;margin-top:2px;letter-spacing:1px;text-transform:uppercase;">
                    Lucid Data Governance
                  </div>
                </td>
                <td align="right">
                  <div style="background:#6DC23A;width:44px;height:44px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;text-align:center;line-height:44px;color:#FFFFFF;font-size:22px;font-weight:900;">VC</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CONTENT -->
        <tr>
          <td style="background:#FFFFFF;padding:36px;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;">
            ${content}
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#1B3A8C;border-radius:0 0 8px 8px;padding:20px 36px;text-align:center;">
            <p style="color:#A0AEC0;font-size:12px;margin:0 0 6px;">
              Este e-mail foi enviado automaticamente pela Plataforma do Lucid Data Governance.
            </p>
            <p style="color:#718096;font-size:11px;margin:0;">
              © ${new Date().getFullYear()} Lucid Data Governance — Governança de Dados &amp; IA
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Button Helper ────────────────────────────────────────────────────────────
function btnPrimary(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;background:#1B3A8C;color:#FFFFFF;font-size:14px;font-weight:700;padding:13px 28px;border-radius:6px;text-decoration:none;margin:8px 0;">${label}</a>`;
}
function btnSecondary(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;background:#6DC23A;color:#FFFFFF;font-size:14px;font-weight:700;padding:13px 28px;border-radius:6px;text-decoration:none;margin:8px 0;">${label}</a>`;
}

// ─── Info Row Helper ──────────────────────────────────────────────────────────
function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;border-bottom:1px solid #F0F4F8;color:#718096;font-size:13px;width:140px;vertical-align:top;">${label}</td>
    <td style="padding:8px 0;border-bottom:1px solid #F0F4F8;color:#1A202C;font-size:13px;font-weight:600;">${value}</td>
  </tr>`;
}

// ─── Template: Convite de Reunião ─────────────────────────────────────────────
export function buildMeetingInviteEmail(params: {
  recipientName: string;
  meetingTitle: string;
  meetingDate: string;
  meetingTime: string;
  location: string;
  agenda: string[];
  confirmUrl: string;
  declineUrl: string;
  organizer: string;
}): { subject: string; html: string } {
  const agendaItems = params.agenda
    .map((item, i) => `<li style="padding:4px 0;color:#2D3748;font-size:14px;">${i + 1}. ${item}</li>`)
    .join("");

  const content = `
    <h2 style="color:#1B3A8C;font-size:22px;font-weight:700;margin:0 0 6px;">Convite para Reunião do Comitê</h2>
    <p style="color:#4A5568;font-size:14px;margin:0 0 24px;">Olá, <strong>${params.recipientName}</strong>! Você está sendo convidado(a) para a reunião abaixo.</p>

    <div style="background:#F7FAFC;border-left:4px solid #1B3A8C;border-radius:0 6px 6px 0;padding:20px 24px;margin-bottom:24px;">
      <div style="color:#1B3A8C;font-size:18px;font-weight:700;margin-bottom:16px;">${params.meetingTitle}</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${infoRow("📅 Data", params.meetingDate)}
        ${infoRow("🕐 Horário", params.meetingTime)}
        ${infoRow("📍 Local/Link", params.location)}
        ${infoRow("👤 Organizador", params.organizer)}
      </table>
    </div>

    ${params.agenda.length > 0 ? `
    <div style="margin-bottom:28px;">
      <div style="color:#1B3A8C;font-size:15px;font-weight:700;margin-bottom:12px;">📋 Pauta da Reunião</div>
      <ul style="margin:0;padding-left:20px;">${agendaItems}</ul>
    </div>` : ""}

    <div style="background:#EBF8FF;border:1px solid #BEE3F8;border-radius:6px;padding:16px 20px;margin-bottom:28px;">
      <p style="color:#2B6CB0;font-size:13px;margin:0;font-weight:600;">Por favor, confirme sua presença até 24h antes da reunião.</p>
    </div>

    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:12px;">${btnPrimary(params.confirmUrl, "✅ Confirmar Presença")}</td>
      <td>${btnSecondary(params.declineUrl, "❌ Não Poderei Comparecer")}</td>
    </tr></table>
  `;

  return {
    subject: `[Lucid Data Governance] Convite: ${params.meetingTitle} — ${params.meetingDate}`,
    html: baseTemplate(content, `Convite para reunião: ${params.meetingTitle} em ${params.meetingDate}`),
  };
}

// ─── Template: Lembrete de Reunião ───────────────────────────────────────────
export function buildMeetingReminderEmail(params: {
  recipientName: string;
  meetingTitle: string;
  meetingDate: string;
  meetingTime: string;
  location: string;
  hoursUntil: number;
  meetingUrl?: string;
}): { subject: string; html: string } {
  const content = `
    <div style="background:#FFF5F5;border-left:4px solid #E53E3E;border-radius:0 6px 6px 0;padding:14px 20px;margin-bottom:24px;">
      <p style="color:#C53030;font-size:14px;font-weight:700;margin:0;">⏰ Lembrete: reunião em ${params.hoursUntil}h</p>
    </div>

    <h2 style="color:#1B3A8C;font-size:20px;font-weight:700;margin:0 0 6px;">Lembrete de Reunião</h2>
    <p style="color:#4A5568;font-size:14px;margin:0 0 24px;">Olá, <strong>${params.recipientName}</strong>! Esta é uma lembrança da sua reunião que ocorrerá em breve.</p>

    <div style="background:#F7FAFC;border-left:4px solid #6DC23A;border-radius:0 6px 6px 0;padding:20px 24px;margin-bottom:28px;">
      <div style="color:#1B3A8C;font-size:17px;font-weight:700;margin-bottom:14px;">${params.meetingTitle}</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${infoRow("📅 Data", params.meetingDate)}
        ${infoRow("🕐 Horário", params.meetingTime)}
        ${infoRow("📍 Local/Link", params.location)}
      </table>
    </div>

    ${params.meetingUrl ? btnPrimary(params.meetingUrl, "🔗 Acessar Reunião") : ""}
  `;

  return {
    subject: `[Lembrete] ${params.meetingTitle} — Hoje às ${params.meetingTime}`,
    html: baseTemplate(content, `Lembrete: ${params.meetingTitle} hoje às ${params.meetingTime}`),
  };
}

// ─── Template: Decisão Registrada ────────────────────────────────────────────
export function buildDecisionEmail(params: {
  recipientName: string;
  meetingTitle: string;
  meetingDate: string;
  decisions: Array<{ title: string; description: string; responsible?: string; deadline?: string }>;
  summaryUrl?: string;
}): { subject: string; html: string } {
  const decisionsHtml = params.decisions
    .map(
      (d, i) => `
      <div style="background:#F7FAFC;border:1px solid #E2E8F0;border-radius:6px;padding:16px 20px;margin-bottom:12px;">
        <div style="color:#1B3A8C;font-size:14px;font-weight:700;margin-bottom:6px;">${i + 1}. ${d.title}</div>
        <p style="color:#4A5568;font-size:13px;margin:0 0 ${d.responsible || d.deadline ? "10px" : "0"};">${d.description}</p>
        ${d.responsible || d.deadline ? `
        <table cellpadding="0" cellspacing="0">
          ${d.responsible ? `<tr><td style="color:#718096;font-size:12px;padding-right:16px;">👤 Responsável:</td><td style="color:#2D3748;font-size:12px;font-weight:600;">${d.responsible}</td></tr>` : ""}
          ${d.deadline ? `<tr><td style="color:#718096;font-size:12px;padding-right:16px;">📅 Prazo:</td><td style="color:#2D3748;font-size:12px;font-weight:600;">${d.deadline}</td></tr>` : ""}
        </table>` : ""}
      </div>`
    )
    .join("");

  const content = `
    <h2 style="color:#1B3A8C;font-size:22px;font-weight:700;margin:0 0 6px;">Decisões Registradas</h2>
    <p style="color:#4A5568;font-size:14px;margin:0 0 8px;">Olá, <strong>${params.recipientName}</strong>! As seguintes decisões foram registradas na reunião:</p>
    <p style="color:#718096;font-size:13px;margin:0 0 24px;"><strong>${params.meetingTitle}</strong> — ${params.meetingDate}</p>

    <div style="margin-bottom:28px;">${decisionsHtml}</div>

    <div style="background:#F0FFF4;border:1px solid #9AE6B4;border-radius:6px;padding:14px 18px;margin-bottom:24px;">
      <p style="color:#276749;font-size:13px;margin:0;">✅ Estas decisões foram formalmente registradas no sistema do Lucid Data Governance.</p>
    </div>

    ${params.summaryUrl ? btnPrimary(params.summaryUrl, "📄 Ver Ata Completa") : ""}
  `;

  return {
    subject: `[Lucid Data Governance] Decisões Registradas — ${params.meetingTitle}`,
    html: baseTemplate(content, `${params.decisions.length} decisão(ões) registrada(s) em ${params.meetingTitle}`),
  };
}

// ─── Template: Ata/Resumo de Reunião ─────────────────────────────────────────
export function buildMeetingSummaryEmail(params: {
  recipientName: string;
  meetingTitle: string;
  meetingDate: string;
  attendees: string[];
  decisions: string[];
  nextSteps: string[];
  nextMeetingDate?: string;
  summaryUrl?: string;
}): { subject: string; html: string } {
  const listItems = (items: string[], color = "#2D3748") =>
    items.length > 0
      ? `<ul style="margin:0;padding-left:20px;">${items.map((i) => `<li style="padding:3px 0;color:${color};font-size:13px;">${i}</li>`).join("")}</ul>`
      : `<p style="color:#A0AEC0;font-size:13px;margin:0;font-style:italic;">Nenhum item registrado.</p>`;

  const content = `
    <h2 style="color:#1B3A8C;font-size:22px;font-weight:700;margin:0 0 6px;">Resumo da Reunião</h2>
    <p style="color:#4A5568;font-size:14px;margin:0 0 24px;">Olá, <strong>${params.recipientName}</strong>! Segue o resumo da reunião realizada.</p>

    <div style="background:#F7FAFC;border-left:4px solid #1B3A8C;border-radius:0 6px 6px 0;padding:16px 20px;margin-bottom:24px;">
      <div style="color:#1B3A8C;font-size:16px;font-weight:700;">${params.meetingTitle}</div>
      <div style="color:#718096;font-size:13px;margin-top:4px;">📅 ${params.meetingDate} &nbsp;|&nbsp; 👥 ${params.attendees.length} participante(s)</div>
    </div>

    <div style="margin-bottom:20px;">
      <div style="color:#1B3A8C;font-size:14px;font-weight:700;margin-bottom:8px;">👥 Participantes</div>
      ${listItems(params.attendees)}
    </div>

    <div style="margin-bottom:20px;">
      <div style="color:#1B3A8C;font-size:14px;font-weight:700;margin-bottom:8px;">✅ Decisões Tomadas</div>
      ${listItems(params.decisions, "#276749")}
    </div>

    <div style="margin-bottom:24px;">
      <div style="color:#1B3A8C;font-size:14px;font-weight:700;margin-bottom:8px;">➡️ Próximos Passos</div>
      ${listItems(params.nextSteps, "#2B6CB0")}
    </div>

    ${params.nextMeetingDate ? `
    <div style="background:#EBF8FF;border:1px solid #BEE3F8;border-radius:6px;padding:14px 18px;margin-bottom:24px;">
      <p style="color:#2B6CB0;font-size:13px;margin:0;font-weight:600;">📅 Próxima Reunião: ${params.nextMeetingDate}</p>
    </div>` : ""}

    ${params.summaryUrl ? btnPrimary(params.summaryUrl, "📄 Acessar Ata Completa") : ""}
  `;

  return {
    subject: `[Lucid Data Governance] Resumo — ${params.meetingTitle} (${params.meetingDate})`,
    html: baseTemplate(content, `Resumo da reunião ${params.meetingTitle}`),
  };
}

// ─── Template: Reunião Cancelada ──────────────────────────────────────────────
export function buildMeetingCancelledEmail(params: {
  recipientName: string;
  meetingTitle: string;
  meetingDate: string;
  reason?: string;
}): { subject: string; html: string } {
  const content = `
    <div style="background:#FFF5F5;border-left:4px solid #E53E3E;border-radius:0 6px 6px 0;padding:14px 20px;margin-bottom:24px;">
      <p style="color:#C53030;font-size:15px;font-weight:700;margin:0;">⚠️ Reunião Cancelada</p>
    </div>

    <h2 style="color:#1B3A8C;font-size:20px;font-weight:700;margin:0 0 6px;">Aviso de Cancelamento</h2>
    <p style="color:#4A5568;font-size:14px;margin:0 0 24px;">Olá, <strong>${params.recipientName}</strong>! Informamos que a reunião abaixo foi cancelada.</p>

    <div style="background:#F7FAFC;border:1px solid #E2E8F0;border-radius:6px;padding:20px 24px;margin-bottom:24px;">
      <div style="color:#1B3A8C;font-size:16px;font-weight:700;margin-bottom:8px;">${params.meetingTitle}</div>
      <div style="color:#718096;font-size:13px;">📅 Data prevista: ${params.meetingDate}</div>
      ${params.reason ? `<div style="color:#4A5568;font-size:13px;margin-top:12px;padding-top:12px;border-top:1px solid #E2E8F0;"><strong>Motivo:</strong> ${params.reason}</div>` : ""}
    </div>

    <p style="color:#718096;font-size:13px;">Uma nova data será comunicada em breve. Pedimos desculpas pelo inconveniente.</p>
  `;

  return {
    subject: `[Cancelado] ${params.meetingTitle} — ${params.meetingDate}`,
    html: baseTemplate(content, `Reunião cancelada: ${params.meetingTitle}`),
  };
}

// ─── Core Send Function ───────────────────────────────────────────────────────
export async function sendEmail(params: {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  notificationId?: number;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const dbConn = await db.getDb();
  const transporter = await createTransporter();

  const [dbFromName, dbFromEmail] = await Promise.all([
    db.getSystemSetting("SMTP_FROM_NAME"),
    db.getSystemSetting("SMTP_FROM_EMAIL"),
  ]);

  const fromName = dbFromName || process.env.SMTP_FROM_NAME || "Lucid Data Governance - Lucid Data Governance";
  const fromEmail = dbFromEmail || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "";

  if (!transporter) {
    // Simulation mode — just log
    console.log(`[Email SIMULATION] To: ${params.to} | Subject: ${params.subject}`);
    if (dbConn && params.notificationId) {
      await dbConn
        .update(emailNotifications)
        .set({ status: "enviado", sentAt: new Date(), errorMessage: "Modo simulação — SMTP não configurado" })
        .where(eq(emailNotifications.id, params.notificationId));
    }
    return { success: true, messageId: "simulation-mode" };
  }

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: params.toName ? `"${params.toName}" <${params.to}>` : params.to,
      subject: params.subject,
      html: params.html,
    });

    if (dbConn && params.notificationId) {
      await dbConn
        .update(emailNotifications)
        .set({ status: "enviado", sentAt: new Date() })
        .where(eq(emailNotifications.id, params.notificationId));
    }

    console.log(`[Email] Sent to ${params.to} — MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Email] Failed to send to ${params.to}:`, errorMsg);

    if (dbConn && params.notificationId) {
      await dbConn
        .update(emailNotifications)
        .set({
          status: "falhou",
          errorMessage: errorMsg,
          retryCount: 1,
        })
        .where(eq(emailNotifications.id, params.notificationId));
    }

    return { success: false, error: errorMsg };
  }
}

// ─── Queue & Dispatch ─────────────────────────────────────────────────────────
export async function queueAndSendEmail(params: {
  type: "meeting_invite" | "meeting_reminder" | "meeting_cancelled" | "decision_registered" | "meeting_summary" | "invite_confirmed" | "invite_declined" | "domain_update" | "custom";
  recipientId?: number;
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  html: string;
  meetingId?: number;
  inviteId?: number;
  metadata?: Record<string, unknown>;
}): Promise<{ success: boolean; notificationId?: number; error?: string }> {
  const dbConn = await db.getDb();

  let notificationId: number | undefined;

  if (dbConn) {
    const [inserted] = await dbConn.insert(emailNotifications).values({
      type: params.type,
      recipientId: params.recipientId,
      recipientEmail: params.recipientEmail,
      recipientName: params.recipientName,
      subject: params.subject,
      htmlBody: params.html,
      status: "pendente",
      meetingId: params.meetingId,
      inviteId: params.inviteId,
      metadata: params.metadata as Record<string, unknown> | null | undefined,
    }).returning();
    notificationId = inserted?.id;
  }

  const result = await sendEmail({
    to: params.recipientEmail,
    toName: params.recipientName,
    subject: params.subject,
    html: params.html,
    notificationId,
  });

  return { ...result, notificationId };
}

// ─── Template de Manutenção de Linhagem ─────────────────────────────────────────
export function buildLineageImpactEmail(params: {
  assetName: string;
  impactReason: string;
  expectedResolution?: string;
}) {
  const content = `
    <div style="padding: 10px; border-left: 4px solid #F59E0B; background-color: #FFFBEB; margin-bottom: 24px;">
      <h2 style="color: #92400E; margin: 0; font-size: 18px;">Aviso de Manutenção / Alteração</h2>
      <p style="color: #B45309; margin: 4px 0 0; font-size: 14px;"><strong>Impacto Detectado na Linhagem de Dados</strong></p>
    </div>
    
    <p style="color: #4A5568; font-size: 15px; line-height: 1.6;">
      Olá especialista, identificamos que você é responsável por um ativo ou dashboard que possui dependência direta do seguinte ativo de dados:
    </p>
    
    <div style="background: #F7FAFC; padding: 20px; border-radius: 8px; border: 1px solid #E2E8F0; margin-bottom: 24px;">
      <div style="font-size: 12px; font-weight: bold; color: #1B3A8C; text-transform: uppercase;">Ativo Origem</div>
      <div style="font-size: 18px; font-weight: 800; color: #1B3A8C; margin-top: 4px;">${params.assetName}</div>
      <div style="margin-top: 16px; font-size: 14px; color: #4A5568;">
        <strong>Motivo do Comunicado:</strong><br/>
        ${params.impactReason}
      </div>
      ${params.expectedResolution ? `
      <div style="margin-top: 16px; font-size: 14px; color: #4A5568;">
        <strong>Previsão de Normalização:</strong><br/>
        ${params.expectedResolution}
      </div>
      ` : ''}
    </div>

    <p style="color: #4A5568; font-size: 15px; line-height: 1.6;">
      <strong>O que você deve fazer?</strong><br/>
      Recomendamos validar seus relatórios e fluxos de dados associados. Em caso de dúvidas, consulte o Catálogo Global ou responda a este comunicado.
    </p>

    <div style="margin-top: 32px; text-align: center;">
      <a href="${process.env.PUBLIC_URL || 'http://localhost:5173'}/catalogo" style="background: #1B3A8C; color: #FFFFFF; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 14px; display: inline-block;">Visualizar no Catálogo</a>
    </div>
  `;
  return baseTemplate(content, `Impacto na Linhagem: ${params.assetName}`);
}

// ─── Verify SMTP Connection ───────────────────────────────────────────────────
export async function verifySmtpConnection(): Promise<{ ok: boolean; message: string }> {
  const transporter = await createTransporter();
  if (!transporter) {
    return { ok: false, message: "SMTP não configurado — modo simulação ativo" };
  }
  try {
    await transporter.verify();
    return { ok: true, message: "Conexão SMTP verificada com sucesso" };
  } catch (err: unknown) {
    console.error("[SMTP Verify] Error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `Falha na conexão SMTP: ${msg}` };
  }
}

// ─── Role Change Email ────────────────────────────────────────────────────────
type AppRole = "user" | "admin" | "data_steward" | "data_owner" | "data_analyst";

export function buildRoleChangeEmail(params: {
  targetName: string;
  executorName: string;
  previousRole: AppRole;
  newRole: AppRole;
  changedAt: Date;
}): { subject: string; html: string } {
  const { targetName, executorName, previousRole, newRole, changedAt } = params;
  const isPromotion = newRole === "admin";
  const actionLabel = isPromotion ? "promovido a Administrador" : `atualizado para ${newRole}`;
  const actionColor = isPromotion ? "#6DC23A" : "#F59E0B";
  const actionIcon = isPromotion ? "⬆" : "⬄";
  const roleLabels: Record<string, string> = {
    admin: "Administrador",
    user: "Usuário",
    data_steward: "Data Steward",
    data_owner: "Data Owner",
    data_analyst: "Data Analyst",
  };
  const dateStr = changedAt.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
  });

  const subject = `${actionIcon} Seu papel foi ${actionLabel} — Lucid Data Governance VC`;

  const content = `
    <tr>
      <td style="background:#FFFFFF;border-radius:0 0 8px 8px;padding:36px;">
        <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#1B3A8C;">Olá, ${targetName}!</p>
        <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
          Informamos que seu papel na plataforma <strong>Lucid Data Governance</strong> foi alterado.
        </p>

        <!-- Role Change Card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr>
            <td style="background:#F8FAFC;border:1px solid #E5E7EB;border-radius:8px;padding:20px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="text-align:center;padding:8px;">
                    <div style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Papel Anterior</div>
                    <div style="background:#F3F4F6;border-radius:6px;padding:8px 16px;display:inline-block;font-size:14px;font-weight:600;color:#374151;">${roleLabels[previousRole]}</div>
                  </td>
                  <td width="10%" style="text-align:center;font-size:20px;color:${actionColor};font-weight:900;">→</td>
                  <td width="40%" style="text-align:center;padding:8px;">
                    <div style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Novo Papel</div>
                    <div style="background:${actionColor};border-radius:6px;padding:8px 16px;display:inline-block;font-size:14px;font-weight:700;color:#FFFFFF;">${roleLabels[newRole]}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Details -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#6B7280;">Executado por:</td>
            <td style="padding:4px 0;font-size:13px;font-weight:600;color:#111827;text-align:right;">${executorName}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#6B7280;">Data e hora:</td>
            <td style="padding:4px 0;font-size:13px;font-weight:600;color:#111827;text-align:right;">${dateStr}</td>
          </tr>
        </table>

        <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.6;">
          Se você acredita que esta alteração foi feita por engano, entre em contato com o administrador da plataforma.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 0;text-align:center;font-size:12px;color:#9CA3AF;">
        Lucid Data Governance &bull; Notificação automática
      </td>
    </tr>
  `;

  return { subject, html: baseTemplate(content, `Seu papel foi ${actionLabel} por ${executorName}`) };
}

export function buildStaleTicketAlertEmail(params: {
  recipientName: string;
  tickets: Array<{
    ticketNumber: string;
    title: string;
    status: string | null;
    priority: string | null;
    daysSinceUpdate: number;
    assignedTo: string | null;
  }>;
  staleDays?: number;
}): { subject: string; html: string } {
  const { recipientName, tickets, staleDays = 7 } = params;
  const priorityLabel: Record<string, string> = {
    critica: "Crítica",
    alta: "Alta",
    media: "Média",
    baixa: "Baixa",
  };
  const statusLabel: Record<string, string> = {
    novo: "Novo",
    em_andamento: "Em Andamento",
    resolvido: "Resolvido",
    fechado: "Fechado",
  };
  const priorityColor: Record<string, string> = {
    critica: "#DC2626",
    alta: "#EA580C",
    media: "#D97706",
    baixa: "#6B7280",
  };
  const ticketRows = tickets
    .map(
      (t) => `
      <tr style="border-bottom:1px solid #E5E7EB;">
        <td style="padding:12px 8px;font-size:13px;font-weight:600;color:#1B3A8C;">${t.ticketNumber}</td>
        <td style="padding:12px 8px;font-size:13px;color:#111827;">${t.title}</td>
        <td style="padding:12px 8px;text-align:center;">
          <span style="background:${priorityColor[t.priority ?? ""] ?? "#6B7280"};color:#fff;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700;">
            ${priorityLabel[t.priority ?? ""] ?? (t.priority ?? "")}
          </span>
        </td>
        <td style="padding:12px 8px;text-align:center;font-size:12px;color:#374151;">${statusLabel[t.status ?? ""] ?? (t.status ?? "")}</td>
        <td style="padding:12px 8px;text-align:center;">
          <span style="color:#DC2626;font-weight:700;font-size:13px;">⚠ ${t.daysSinceUpdate} dia${t.daysSinceUpdate !== 1 ? "s" : ""}</span>
        </td>
      </tr>`
    )
    .join("");
  const subject = `⚠ ${tickets.length} ticket${tickets.length !== 1 ? "s" : ""} de alta prioridade parado${tickets.length !== 1 ? "s" : ""} há mais de ${staleDays} dias — Lucid Data Governance VC`;
  const content = `
    <tr>
      <td style="background:#FFFFFF;border-radius:0 0 8px 8px;padding:36px;">
        <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#1B3A8C;">Olá, ${recipientName}!</p>
        <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
          Os seguintes tickets de <strong>alta prioridade ou crítica</strong> sob sua responsabilidade
          não foram atualizados há mais de <strong>${staleDays} dias</strong>.
          Por favor, revise e atualize o status desses tickets o quanto antes.
        </p>
        <!-- Alert Banner -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr>
            <td style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:16px;">
              <p style="margin:0;font-size:14px;font-weight:600;color:#DC2626;">
                ⚠ ${tickets.length} ticket${tickets.length !== 1 ? "s" : ""} requer${tickets.length === 1 ? "" : "em"} atenção imediata
              </p>
            </td>
          </tr>
        </table>
        <!-- Tickets Table -->
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;margin-bottom:24px;">
          <thead>
            <tr style="background:#1B3A8C;">
              <th style="padding:10px 8px;text-align:left;font-size:11px;color:#FFFFFF;text-transform:uppercase;letter-spacing:0.5px;">Ticket</th>
              <th style="padding:10px 8px;text-align:left;font-size:11px;color:#FFFFFF;text-transform:uppercase;letter-spacing:0.5px;">Título</th>
              <th style="padding:10px 8px;text-align:center;font-size:11px;color:#FFFFFF;text-transform:uppercase;letter-spacing:0.5px;">Prioridade</th>
              <th style="padding:10px 8px;text-align:center;font-size:11px;color:#FFFFFF;text-transform:uppercase;letter-spacing:0.5px;">Status</th>
              <th style="padding:10px 8px;text-align:center;font-size:11px;color:#FFFFFF;text-transform:uppercase;letter-spacing:0.5px;">Parado há</th>
            </tr>
          </thead>
          <tbody>
            ${ticketRows}
          </tbody>
        </table>
        <p style="margin:0 0 16px;font-size:13px;color:#6B7280;line-height:1.6;">
          Acesse a plataforma <strong>Lucid Data Governance</strong> para atualizar o status dos tickets.
        </p>
        <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.6;">
          Este alerta é enviado automaticamente todos os dias às 8h para tickets de alta/crítica prioridade
          sem atualização por mais de ${staleDays} dias.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 0;text-align:center;font-size:12px;color:#9CA3AF;">
        Lucid Data Governance &bull; Alerta automático de tickets parados
      </td>
    </tr>
  `;
  return { subject, html: baseTemplate(content, `${tickets.length} ticket(s) de alta prioridade sem atualização há ${staleDays}+ dias`) };
}

// ─── Tier Approval & Sync Emails ──────────────────────────────────────────────
export function buildTierApprovalEmail(params: {
  domainName: string;
  tier: number;
  approvedBy: string;
  notes?: string;
  recipientName: string;
}) {
  const subject = `[Lucid Data Governance] Tier ${params.tier} aprovado para o domínio "${params.domainName}"`;
  const tierLabels: Record<number, string> = {
    0: 'Tier 0 — Bloqueado',
    1: 'Tier 1 — Exploração',
    2: 'Tier 2 — Colaboração',
    3: 'Tier 3 — Produção',
    4: 'Tier 4 — Autonomia Total',
  };
  const content = `
    <tr>
      <td style="padding:32px 40px 0;">
        <h2 style="margin:0 0 8px;font-size:20px;color:#1B3A8C;">Tier de Autonomia Aprovado</h2>
        <p style="margin:0 0 24px;font-size:14px;color:#6B7280;">Olá, ${params.recipientName}. O Tier de Autonomia do seu domínio foi aprovado.</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <tr><td style="padding:10px 12px;background:#F3F4F6;font-size:13px;color:#374151;font-weight:600;width:40%;">Domínio</td><td style="padding:10px 12px;font-size:13px;color:#111827;">${params.domainName}</td></tr>
          <tr><td style="padding:10px 12px;background:#F3F4F6;font-size:13px;color:#374151;font-weight:600;">Tier Aprovado</td><td style="padding:10px 12px;font-size:13px;color:#111827;font-weight:700;">${tierLabels[params.tier] ?? `Tier ${params.tier}`}</td></tr>
          <tr><td style="padding:10px 12px;background:#F3F4F6;font-size:13px;color:#374151;font-weight:600;">Aprovado por</td><td style="padding:10px 12px;font-size:13px;color:#111827;">${params.approvedBy}</td></tr>
          ${params.notes ? `<tr><td style="padding:10px 12px;background:#F3F4F6;font-size:13px;color:#374151;font-weight:600;">Observações</td><td style="padding:10px 12px;font-size:13px;color:#111827;">${params.notes}</td></tr>` : ''}
        </table>
        <p style="margin:0 0 16px;font-size:13px;color:#374151;">O próximo passo é executar o <strong>Sync Databricks</strong> para aplicar as políticas de acesso no Unity Catalog.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 0;text-align:center;font-size:12px;color:#9CA3AF;">
        Lucid Data Governance &bull; Notificação automática
      </td>
    </tr>
  `;
  return { subject, html: baseTemplate(content, `Tier ${params.tier} aprovado para "${params.domainName}"`) };
}

export function buildTierSyncResultEmail(params: {
  domainName: string;
  tier: number;
  applied: number;
  failed: number;
  databricksGroup: string;
  catalog: string;
  schema: string;
  performedBy: string;
  recipientName: string;
  isBatch?: boolean;
}) {
  const subject = params.isBatch
    ? `[Lucid Data Governance] Sync em lote de Tier concluído`
    : `[Lucid Data Governance] Sync Databricks concluído — "${params.domainName}"`;
  const statusColor = params.failed === 0 ? '#16A34A' : params.applied > 0 ? '#D97706' : '#DC2626';
  const statusText = params.failed === 0 ? 'Sucesso' : params.applied > 0 ? 'Parcial' : 'Falhou';
  const content = `
    <tr>
      <td style="padding:32px 40px 0;">
        <h2 style="margin:0 0 8px;font-size:20px;color:#1B3A8C;">Resultado do Sync Databricks</h2>
        <p style="margin:0 0 24px;font-size:14px;color:#6B7280;">Olá, ${params.recipientName}. O sync de políticas de Tier foi concluído.</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <tr><td style="padding:10px 12px;background:#F3F4F6;font-size:13px;color:#374151;font-weight:600;width:40%;">Domínio</td><td style="padding:10px 12px;font-size:13px;color:#111827;">${params.domainName}</td></tr>
          <tr><td style="padding:10px 12px;background:#F3F4F6;font-size:13px;color:#374151;font-weight:600;">Status</td><td style="padding:10px 12px;font-size:13px;font-weight:700;color:${statusColor};">${statusText}</td></tr>
          <tr><td style="padding:10px 12px;background:#F3F4F6;font-size:13px;color:#374151;font-weight:600;">Políticas Aplicadas</td><td style="padding:10px 12px;font-size:13px;color:#111827;">${params.applied}</td></tr>
          <tr><td style="padding:10px 12px;background:#F3F4F6;font-size:13px;color:#374151;font-weight:600;">Falhas</td><td style="padding:10px 12px;font-size:13px;color:#111827;">${params.failed}</td></tr>
          <tr><td style="padding:10px 12px;background:#F3F4F6;font-size:13px;color:#374151;font-weight:600;">Grupo Databricks</td><td style="padding:10px 12px;font-size:13px;color:#111827;">${params.databricksGroup}</td></tr>
          <tr><td style="padding:10px 12px;background:#F3F4F6;font-size:13px;color:#374151;font-weight:600;">Catalog / Schema</td><td style="padding:10px 12px;font-size:13px;color:#111827;">${params.catalog}.${params.schema}</td></tr>
          <tr><td style="padding:10px 12px;background:#F3F4F6;font-size:13px;color:#374151;font-weight:600;">Executado por</td><td style="padding:10px 12px;font-size:13px;color:#111827;">${params.performedBy}</td></tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 0;text-align:center;font-size:12px;color:#9CA3AF;">
        Lucid Data Governance &bull; Notificação automática
      </td>
    </tr>
  `;
  return { subject, html: baseTemplate(content, subject) };
}
