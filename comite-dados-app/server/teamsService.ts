/**
 * teamsService.ts
 * Integração com Microsoft Teams via Microsoft Graph API.
 *
 * Requer as variáveis de ambiente:
 *   TEAMS_TENANT_ID   — ID do tenant Azure AD da organização
 *   TEAMS_CLIENT_ID   — ID do app registrado no Azure AD
 *   TEAMS_CLIENT_SECRET — Secret do app Azure AD
 *
 * Permissões necessárias no Azure AD:
 *   OnlineMeetings.ReadWrite.All
 *   OnlineMeetingArtifact.Read.All
 *
 * Quando as credenciais não estão configuradas, todas as funções
 * retornam null / [] sem lançar erro (modo degradado).
 */

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

// ─── Helpers internos ────────────────────────────────────────────────────────

function getCredentials() {
  const tenantId = process.env.TEAMS_TENANT_ID;
  const clientId = process.env.TEAMS_CLIENT_ID;
  const clientSecret = process.env.TEAMS_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) return null;
  return { tenantId, clientId, clientSecret };
}

/** Obtém token de acesso via client_credentials flow */
async function getAccessToken(): Promise<string | null> {
  const creds = getCredentials();
  if (!creds) return null;

  const { tenantId, clientId, clientSecret } = creds;
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
  });

  try {
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[Teams] Token error:", err);
      return null;
    }
    const data = await res.json() as { access_token: string };
    return data.access_token;
  } catch (e) {
    console.error("[Teams] Token fetch failed:", e);
    return null;
  }
}

async function graphRequest<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T | null> {
  const token = await getAccessToken();
  if (!token) return null;

  try {
    const res = await fetch(`${GRAPH_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[Teams] Graph ${method} ${path} error:`, err);
      return null;
    }
    if (res.status === 204) return null;
    return res.json() as Promise<T>;
  } catch (e) {
    console.error(`[Teams] Graph request failed:`, e);
    return null;
  }
}

// ─── Tipos Graph API ─────────────────────────────────────────────────────────

interface GraphOnlineMeeting {
  id: string;
  joinWebUrl: string;
  subject: string;
  startDateTime: string;
  endDateTime: string;
}

interface GraphAttendanceRecord {
  emailAddress: string;
  totalAttendanceInSeconds: number;
  role: string;
  identity: {
    displayName: string;
    id: string;
  };
  attendanceIntervals: Array<{
    joinDateTime: string;
    leaveDateTime: string;
    durationInSeconds: number;
  }>;
}

interface GraphAttendanceReport {
  id: string;
  totalParticipantCount: number;
  attendanceRecords: GraphAttendanceRecord[];
}

// ─── API pública do serviço ───────────────────────────────────────────────────

export interface TeamsMeetingResult {
  teamsMeetingId: string;
  teamsJoinUrl: string;
}

/**
 * Cria uma reunião online no Microsoft Teams.
 * Retorna null se as credenciais não estiverem configuradas.
 */
export async function createTeamsMeeting(
  title: string,
  startDateTime: Date,
  endDateTime: Date
): Promise<TeamsMeetingResult | null> {
  const result = await graphRequest<GraphOnlineMeeting>(
    "POST",
    "/me/onlineMeetings",
    {
      subject: title,
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString(),
    }
  );
  if (!result) return null;
  return {
    teamsMeetingId: result.id,
    teamsJoinUrl: result.joinWebUrl,
  };
}

export interface AttendanceEntry {
  participantName: string;
  participantEmail: string;
  joinedAt: Date | null;
  leftAt: Date | null;
  durationMinutes: number;
  attended: boolean;
}

/**
 * Busca o relatório de presença de uma reunião Teams.
 * Retorna array vazio se as credenciais não estiverem configuradas
 * ou se o relatório ainda não estiver disponível (reunião em andamento).
 */
export async function getAttendanceReport(
  teamsMeetingId: string
): Promise<AttendanceEntry[]> {
  // Busca a lista de relatórios de presença disponíveis
  const reportsRes = await graphRequest<{ value: Array<{ id: string }> }>(
    "GET",
    `/me/onlineMeetings/${teamsMeetingId}/attendanceReports`
  );
  if (!reportsRes || !reportsRes.value || reportsRes.value.length === 0) {
    return [];
  }

  // Usa o relatório mais recente
  const latestReportId = reportsRes.value[reportsRes.value.length - 1].id;

  const report = await graphRequest<GraphAttendanceReport>(
    "GET",
    `/me/onlineMeetings/${teamsMeetingId}/attendanceReports/${latestReportId}?$expand=attendanceRecords`
  );
  if (!report || !report.attendanceRecords) return [];

  return report.attendanceRecords.map((rec) => {
    const firstInterval = rec.attendanceIntervals?.[0];
    const lastInterval = rec.attendanceIntervals?.[rec.attendanceIntervals.length - 1];
    const durationSec = rec.totalAttendanceInSeconds ?? 0;
    const durationMinutes = Math.round(durationSec / 60);

    return {
      participantName: rec.identity?.displayName ?? rec.emailAddress ?? "Desconhecido",
      participantEmail: rec.emailAddress ?? "",
      joinedAt: firstInterval?.joinDateTime ? new Date(firstInterval.joinDateTime) : null,
      leftAt: lastInterval?.leaveDateTime ? new Date(lastInterval.leaveDateTime) : null,
      durationMinutes,
      // Considera presente se ficou ao menos 5 minutos
      attended: durationMinutes >= 5,
    };
  });
}

/**
 * Verifica se as credenciais do Teams estão configuradas.
 */
export function isTeamsConfigured(): boolean {
  return getCredentials() !== null;
}
