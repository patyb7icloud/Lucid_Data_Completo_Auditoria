/**
 * ticketAlertScheduler.ts
 *
 * Job diário que verifica tickets ServiceNow de prioridade alta ou crítica
 * que estão em aberto (novo / em_andamento) e não foram atualizados dentro
 * do limiar configurado para o domínio do ticket.
 *
 * Limiares por domínio são lidos da tabela `ticket_alert_configs`. Quando
 * não há configuração específica para um domínio, são usados os padrões globais:
 *   - Crítico: GLOBAL_CRITICAL_DAYS dias
 *   - Alta:    GLOBAL_HIGH_DAYS dias
 *
 * Domínios com `enabled = 0` na configuração são ignorados.
 *
 * Horário de execução: todos os dias às 8h (horário do servidor).
 */

import {
  getAllOpenHighPriorityTickets,
  getTicketAlertConfigs,
} from "./db";
import { queueAndSendEmail, buildStaleTicketAlertEmail } from "./emailService";

// ─── Padrões globais ──────────────────────────────────────────────────────────
const GLOBAL_CRITICAL_DAYS = 3;
const GLOBAL_HIGH_DAYS = 7;

let schedulerTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Calcula os ms até as `targetHour`h do próximo dia (ou hoje se ainda não passou). */
function msUntilNextRun(targetHour = 8): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(targetHour, 0, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

/** Retorna o limiar de dias para o nível de prioridade e domínio informados,
 *  consultando a tabela de configurações. Usa os padrões globais como fallback. */
function getThreshold(
  priority: string | null,
  domainId: number | null,
  configMap: Map<number, { criticalDays: number | null; highDays: number | null; enabled: number | null }>
): number | null {
  // Se o domínio tem configuração com enabled = 0, retorna null (ignorar)
  if (domainId !== null) {
    const cfg = configMap.get(domainId);
    if (cfg && (cfg.enabled ?? 1) === 0) {
      return null; // Alertas desabilitados para este domínio
    }
    if (cfg) {
      if (priority === "critica") return cfg.criticalDays ?? GLOBAL_CRITICAL_DAYS;
      if (priority === "alta") return cfg.highDays ?? GLOBAL_HIGH_DAYS;
    }
  }
  // Fallback global
  if (priority === "critica") return GLOBAL_CRITICAL_DAYS;
  if (priority === "alta") return GLOBAL_HIGH_DAYS;
  return GLOBAL_HIGH_DAYS;
}

// ─── Lógica principal ─────────────────────────────────────────────────────────

export interface TicketAlertRunResult {
  /** Total de tickets elegíveis encontrados */
  totalTickets: number;
  /** Total de tickets que ultrapassaram o limiar */
  staleTickets: number;
  /** Número de e-mails enviados com sucesso */
  emailsSent: number;
  /** Número de e-mails que falharam */
  emailsFailed: number;
  /** Responsáveis notificados (e-mail) */
  recipients: string[];
  /** Mensagem de resumo legível */
  summary: string;
}

/**
 * Executa a verificação de tickets parados e envia alertas.
 * Pode ser chamada tanto pelo scheduler automático quanto manualmente.
 * Retorna um objeto com o resultado da execução.
 */
export async function runTicketAlertCheck(): Promise<TicketAlertRunResult> {
  const result: TicketAlertRunResult = {
    totalTickets: 0,
    staleTickets: 0,
    emailsSent: 0,
    emailsFailed: 0,
    recipients: [],
    summary: "",
  };

  try {
    // 1. Carrega todas as configurações por domínio
    const configs = await getTicketAlertConfigs();
    const configMap = new Map(
      configs.map((c) => [
        c.domainId,
        { criticalDays: c.criticalDays, highDays: c.highDays, enabled: c.enabled },
      ])
    );

    // 2. Busca todos os tickets elegíveis (sem filtro de data — aplicamos abaixo)
    const allTickets = await getAllOpenHighPriorityTickets();
    result.totalTickets = allTickets.length;

    if (allTickets.length === 0) {
      result.summary = "Nenhum ticket de alta/crítica prioridade em aberto.";
      console.log(`[TicketAlertScheduler] ${result.summary}`);
      return result;
    }

    const now = Date.now();

    // 3. Filtra os tickets que ultrapassaram o limiar do seu domínio
    const staleList = allTickets.filter((ticket) => {
      if (!ticket.updatedAt) return false;
      const threshold = getThreshold(ticket.priority, ticket.domainId, configMap);
      if (threshold === null) return false; // Domínio desabilitado
      const daysSince = Math.floor(
        (now - new Date(ticket.updatedAt).getTime()) / (24 * 60 * 60 * 1000)
      );
      return daysSince >= threshold;
    });

    result.staleTickets = staleList.length;

    if (staleList.length === 0) {
      result.summary = "Nenhum ticket parado encontrado com os limiares configurados.";
      console.log(`[TicketAlertScheduler] ${result.summary}`);
      return result;
    }

    console.log(
      `[TicketAlertScheduler] ${staleList.length} ticket(s) parado(s) encontrado(s) (limiares dinâmicos por domínio).`
    );

    // 4. Enriquece cada ticket com daysSinceUpdate e staleDays para o e-mail
    type EnrichedTicket = (typeof staleList)[number] & {
      daysSinceUpdate: number;
      staleDays: number;
    };

    const enriched: EnrichedTicket[] = staleList.map((ticket) => {
      const threshold = getThreshold(ticket.priority, ticket.domainId, configMap) ?? GLOBAL_HIGH_DAYS;
      const daysSince = ticket.updatedAt
        ? Math.floor((now - new Date(ticket.updatedAt).getTime()) / (24 * 60 * 60 * 1000))
        : threshold;
      return { ...ticket, daysSinceUpdate: daysSince, staleDays: threshold };
    });

    // 5. Agrupa por responsável (participantEmail ou assignedTo como fallback)
    const byRecipient = new Map<
      string,
      { name: string; email: string; tickets: EnrichedTicket[] }
    >();

    for (const ticket of enriched) {
      const email = ticket.participantEmail ?? null;
      const name = ticket.participantName ?? ticket.assignedTo ?? "Responsável";
      if (!email) {
        console.warn(
          `[TicketAlertScheduler] Ticket ${ticket.ticketNumber} sem e-mail de responsável — pulando.`
        );
        continue;
      }
      if (!byRecipient.has(email)) {
        byRecipient.set(email, { name, email, tickets: [] });
      }
      byRecipient.get(email)!.tickets.push(ticket);
    }

    // 6. Envia um e-mail por responsável
    for (const [email, { name, tickets: recipientTickets }] of Array.from(byRecipient.entries())) {
      try {
        const representativeStaleDays = recipientTickets[0].staleDays;
        const { subject, html } = buildStaleTicketAlertEmail({
          recipientName: name,
          tickets: recipientTickets,
          staleDays: representativeStaleDays,
        });
        await queueAndSendEmail({
          type: "custom",
          recipientEmail: email,
          recipientName: name,
          subject,
          html,
        });
        result.emailsSent++;
        result.recipients.push(email);
        console.log(
          `[TicketAlertScheduler] Alerta enviado para ${email} (${recipientTickets.length} ticket(s)).`
        );
      } catch (err) {
        result.emailsFailed++;
        console.error(`[TicketAlertScheduler] Erro ao enviar alerta para ${email}:`, err);
      }
    }

    result.summary =
      `${result.staleTickets} ticket(s) parado(s) encontrado(s). ` +
      `${result.emailsSent} e-mail(s) enviado(s)` +
      (result.emailsFailed > 0 ? `, ${result.emailsFailed} falha(s).` : ".");
    console.log(`[TicketAlertScheduler] ${result.summary}`);
  } catch (err) {
    console.error("[TicketAlertScheduler] Erro no job de alerta:", err);
    result.summary = `Erro durante a execução: ${err instanceof Error ? err.message : String(err)}`;
  }

  return result;
}

async function checkAndAlertStaleTickets(): Promise<void> {
  await runTicketAlertCheck();
}

// ─── Agendamento ──────────────────────────────────────────────────────────────

function scheduleNextRun(): void {
  const delay = msUntilNextRun(8);
  const nextRunAt = new Date(Date.now() + delay);
  console.log(
    `[TicketAlertScheduler] Próxima execução agendada para ${nextRunAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`
  );
  schedulerTimer = setTimeout(async () => {
    await checkAndAlertStaleTickets();
    scheduleNextRun(); // Reagenda para o dia seguinte
  }, delay);
}

/**
 * Inicia o scheduler de alerta de tickets parados.
 * Deve ser chamado uma única vez durante a inicialização do servidor.
 */
export function startTicketAlertScheduler(): void {
  if (schedulerTimer) {
    console.warn("[TicketAlertScheduler] Scheduler já está em execução.");
    return;
  }
  console.log(
    `[TicketAlertScheduler] Iniciado — alertas diários às 8h com limiares dinâmicos por domínio ` +
    `(padrão global: crítico=${GLOBAL_CRITICAL_DAYS}d, alta=${GLOBAL_HIGH_DAYS}d).`
  );
  scheduleNextRun();
}

/**
 * Para o scheduler (útil em testes ou graceful shutdown).
 */
export function stopTicketAlertScheduler(): void {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
    console.log("[TicketAlertScheduler] Parado.");
  }
}
