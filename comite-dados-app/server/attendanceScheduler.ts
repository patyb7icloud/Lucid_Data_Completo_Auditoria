/**
 * attendanceScheduler.ts
 *
 * Job periódico que verifica a cada 5 minutos se há reuniões do Teams
 * cujo horário de término passou há pelo menos 10 minutos e que ainda
 * não tiveram a presença sincronizada. Para cada reunião elegível,
 * dispara a sincronização automática via Graph API.
 *
 * Critérios de elegibilidade:
 *   - teamsMeetingId preenchido (vinculada ao Teams)
 *   - status = 'realizada'
 *   - endAt <= agora - 10 minutos
 *   - teamsAttendanceSyncedAt IS NULL (ainda não sincronizada)
 */

import { getAttendanceReport, isTeamsConfigured } from "./teamsService";
import {
  getMeetingsPendingAttendanceSync,
  upsertAttendanceRecord,
  deleteAttendanceByMeeting,
  updateMeetingTeamsInfo,
} from "./db";

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
const GRACE_PERIOD_MS = 10 * 60 * 1000; // 10 minutos após término

let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

async function syncPendingMeetings(): Promise<void> {
  if (!isTeamsConfigured()) return;
  if (isRunning) return; // Evita execuções sobrepostas

  isRunning = true;
  try {
    const cutoff = new Date(Date.now() - GRACE_PERIOD_MS);
    const meetings = await getMeetingsPendingAttendanceSync(cutoff);

    if (meetings.length === 0) return;

    console.log(`[AttendanceScheduler] ${meetings.length} reunião(ões) pendente(s) de sincronização.`);

    for (const meeting of meetings) {
      try {
        console.log(`[AttendanceScheduler] Sincronizando reunião #${meeting.id}: "${meeting.title}"`);

        const records = await getAttendanceReport(meeting.teamsMeetingId!);

        if (records.length === 0) {
          console.log(`[AttendanceScheduler] Reunião #${meeting.id}: relatório ainda não disponível, tentará novamente.`);
          continue;
        }

        // Substitui registros anteriores pelos dados mais recentes do Teams
        await deleteAttendanceByMeeting(meeting.id);
        for (const rec of records) {
          await upsertAttendanceRecord({
            meetingId: meeting.id,
            participantName: rec.participantName,
            participantEmail: rec.participantEmail,
            joinedAt: rec.joinedAt ?? undefined,
            leftAt: rec.leftAt ?? undefined,
            durationMinutes: rec.durationMinutes,
            attended: rec.attended,
            source: "teams",
          });
        }

        await updateMeetingTeamsInfo(meeting.id, {
          teamsAttendanceSyncedAt: new Date(),
        });

        console.log(
          `[AttendanceScheduler] Reunião #${meeting.id}: ${records.length} registro(s) sincronizado(s) com sucesso.`
        );
      } catch (err) {
        console.error(`[AttendanceScheduler] Erro ao sincronizar reunião #${meeting.id}:`, err);
        // Continua para a próxima reunião sem interromper o job
      }
    }
  } catch (err) {
    console.error("[AttendanceScheduler] Erro no job de sincronização:", err);
  } finally {
    isRunning = false;
  }
}

/**
 * Inicia o scheduler de sincronização automática de presença.
 * Deve ser chamado uma única vez durante a inicialização do servidor.
 */
export function startAttendanceScheduler(): void {
  if (schedulerTimer) {
    console.warn("[AttendanceScheduler] Scheduler já está em execução.");
    return;
  }

  console.log(
    `[AttendanceScheduler] Iniciado — verificação a cada ${INTERVAL_MS / 60000} min, ` +
    `sincroniza reuniões encerradas há ≥ ${GRACE_PERIOD_MS / 60000} min.`
  );

  // Executa imediatamente na inicialização para recuperar reuniões pendentes
  syncPendingMeetings().catch(console.error);

  schedulerTimer = setInterval(() => {
    syncPendingMeetings().catch(console.error);
  }, INTERVAL_MS);
}

/**
 * Para o scheduler (útil em testes ou graceful shutdown).
 */
export function stopAttendanceScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log("[AttendanceScheduler] Parado.");
  }
}
