import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useState } from "react";
import { ArrowLeft, Clock, MapPin, Video, Plus, CheckCircle, FileText, FileDown, Download, Users2, RefreshCw, ExternalLink } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  agendada: "bg-blue-100 text-blue-700",
  realizada: "bg-green-100 text-green-700",
  cancelada: "bg-red-100 text-red-700",
  adiada: "bg-amber-100 text-amber-700",
};

export default function MeetingDetail() {
  const params = useParams();
  const id = parseInt(params.id ?? "0");
  const utils = trpc.useUtils();
  const { data: meeting, isLoading } = trpc.meetings.byId.useQuery({ id });
  const { data: agendaItems } = trpc.meetings.getAgenda.useQuery({ meetingId: id });
  const { data: invites } = trpc.invites.byMeeting.useQuery({ meetingId: id });
  const [newItem, setNewItem] = useState({ title: "", description: "", duration: "" });
  const [minutes, setMinutes] = useState("");
  const [decisions, setDecisions] = useState("");
  const [actionItems, setActionItems] = useState("");
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [isSyncingAttendance, setIsSyncingAttendance] = useState(false);

  const { data: isTeamsConfigured } = trpc.teams.isConfigured.useQuery();
  const { data: attendance, refetch: refetchAttendance } = trpc.teams.attendance.useQuery({ meetingId: id });

  const createTeamsMeetingMutation = trpc.teams.createMeeting.useMutation({
    onSuccess: () => {
      utils.meetings.byId.invalidate({ id });
      toast.success('Reunião criada no Microsoft Teams!');
    },
    onError: (e) => toast.error('Erro ao criar no Teams: ' + e.message),
  });

  const syncAttendanceMutation = trpc.teams.syncAttendance.useMutation({
    onSuccess: (data) => {
      setIsSyncingAttendance(false);
      refetchAttendance();
      toast.success(data.message);
    },
    onError: (e) => { setIsSyncingAttendance(false); toast.error('Erro ao sincronizar: ' + e.message); },
  });

  const exportPDFMutation = trpc.export.meetingMinutesPDF.useMutation({
    onSuccess: (data) => {
      setIsExporting(null);
      window.open(data.url, "_blank");
      toast.success("Ata exportada em PDF! Abrindo download...");
    },
    onError: (e) => { setIsExporting(null); toast.error("Erro ao gerar PDF: " + e.message); },
  });

  const exportDOCXMutation = trpc.export.meetingMinutesDOCX.useMutation({
    onSuccess: (data) => {
      setIsExporting(null);
      const a = document.createElement("a");
      a.href = data.url;
      a.download = data.filename;
      a.click();
      toast.success("Ata exportada em DOCX!");
    },
    onError: (e) => { setIsExporting(null); toast.error("Erro ao gerar DOCX: " + e.message); },
  });

  const addAgendaMutation = trpc.meetings.addAgendaItem.useMutation({
    onSuccess: () => {
      utils.meetings.getAgenda.invalidate({ meetingId: id });
      toast.success("Item adicionado!");
      setNewItem({ title: "", description: "", duration: "" });
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const updateMutation = trpc.meetings.update.useMutation({
    onSuccess: () => { utils.meetings.byId.invalidate({ id }); toast.success("Salvo!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  if (isLoading) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div>
    </div>
  );
  if (!meeting) return <div className="text-center py-12 text-gray-500">Reunião não encontrada.</div>;

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/reunioes">
          <Button variant="ghost" size="sm" className="gap-1 text-gray-500">
            <ArrowLeft size={14} /> Voltar
          </Button>
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex-1">{meeting.title}</h1>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-xs border-[#1B3A8C] text-[#1B3A8C] hover:bg-[#E8EDF8]"
            disabled={isExporting === "pdf"}
            onClick={() => { setIsExporting("pdf"); exportPDFMutation.mutate({ meetingId: id }); }}
          >
            <FileText size={13} />
            {isExporting === "pdf" ? "Gerando..." : "Exportar PDF"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-xs border-[#1B3A8C] text-[#1B3A8C] hover:bg-[#E8EDF8]"
            disabled={isExporting === "docx"}
            onClick={() => { setIsExporting("docx"); exportDOCXMutation.mutate({ meetingId: id }); }}
          >
            <FileDown size={13} />
            {isExporting === "docx" ? "Gerando..." : "Exportar DOCX"}
          </Button>
          {isTeamsConfigured && !meeting.teamsMeetingId && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-xs border-[#0078D4] text-[#0078D4] hover:bg-[#E8F0FA]"
              disabled={createTeamsMeetingMutation.isPending}
              onClick={() => createTeamsMeetingMutation.mutate({ meetingId: id })}
            >
              <Video size={13} />
              {createTeamsMeetingMutation.isPending ? 'Criando...' : 'Criar no Teams'}
            </Button>
          )}
          {meeting.teamsMeetingId && meeting.teamsJoinUrl && (
            <a href={meeting.teamsJoinUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="gap-1 text-xs border-[#0078D4] text-[#0078D4] hover:bg-[#E8F0FA]">
                <ExternalLink size={13} /> Entrar no Teams
              </Button>
            </a>
          )}
          {meeting.status === "agendada" && (
            <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1 text-xs"
              onClick={() => updateMutation.mutate({ id, status: "realizada" })}>
              <CheckCircle size={13} /> Marcar Realizada
            </Button>
          )}
        </div>
      </div>

      <Card className="border border-gray-100 shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge className={`text-xs ${STATUS_COLORS[meeting.status ?? "agendada"]}`}>{meeting.status}</Badge>
            <Badge variant="outline" className="text-xs">{meeting.type}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Clock size={14} className="text-[#1B3A8C]" />
              {new Date(meeting.scheduledAt).toLocaleDateString("pt-BR", {
                weekday: "long", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
              })}
            </div>
            {meeting.location && (
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin size={14} className="text-[#1B3A8C]" />{meeting.location}
              </div>
            )}
            {meeting.meetingLink && (
              <div className="flex items-center gap-2 text-blue-600">
                <Video size={14} />
                <a href={meeting.meetingLink} target="_blank" className="hover:underline text-xs">Entrar na reunião</a>
              </div>
            )}
            {meeting.teamsJoinUrl && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[#E8F0FA] text-[#0078D4]">
                  <Video size={11} /> Integrado ao Teams
                </span>
                {meeting.teamsAttendanceSyncedAt && (
                  <span className="text-xs text-gray-400">
                    Presença sincronizada em {new Date(meeting.teamsAttendanceSyncedAt).toLocaleString('pt-BR')}
                  </span>
                )}
              </div>
            )}
          </div>
          {meeting.description && (
            <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{meeting.description}</p>
          )}
        </CardContent>
      </Card>

      {/* Agenda */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-gray-800">Pauta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(agendaItems ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Nenhum item na pauta</p>
          ) : (
            <div className="space-y-2">
              {(agendaItems ?? []).map((item, i) => (
                <div key={item.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-xs font-bold text-[#1B3A8C] bg-blue-100 rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{item.title}</p>
                    {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                    {item.duration && <p className="text-xs text-gray-400 mt-0.5">{item.duration} min</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-medium text-gray-600">Adicionar item à pauta</p>
            <div className="grid grid-cols-3 gap-2">
              <Input value={newItem.title} onChange={(e) => setNewItem(f => ({ ...f, title: e.target.value }))}
                placeholder="Título *" className="col-span-2 h-8 text-xs" />
              <Input value={newItem.duration} onChange={(e) => setNewItem(f => ({ ...f, duration: e.target.value }))}
                placeholder="Duração (min)" className="h-8 text-xs" type="number" />
            </div>
            <Input value={newItem.description} onChange={(e) => setNewItem(f => ({ ...f, description: e.target.value }))}
              placeholder="Descrição (opcional)" className="h-8 text-xs" />
            <Button size="sm" className="bg-[#1B3A8C] hover:bg-[#122970] gap-1 text-xs"
              onClick={() => {
                if (!newItem.title) { toast.error("Título obrigatório"); return; }
                addAgendaMutation.mutate({
                  meetingId: id, title: newItem.title,
                  description: newItem.description || undefined,
                  duration: newItem.duration ? parseInt(newItem.duration) : undefined
                });
              }}
              disabled={addAgendaMutation.isPending}>
              <Plus size={12} /> Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Minutes */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-gray-800">Ata da Reunião</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs font-medium">Resumo / Ata</Label>
            <Textarea defaultValue={meeting.minutesContent ?? ""} onChange={(e) => setMinutes(e.target.value)}
              placeholder="Registre o resumo da reunião..." className="text-sm resize-none" rows={4} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium">Decisões Tomadas</Label>
            <Textarea defaultValue={meeting.decisionsContent ?? ""} onChange={(e) => setDecisions(e.target.value)}
              placeholder="Liste as decisões tomadas..." className="text-sm resize-none" rows={3} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium">Encaminhamentos / Action Items</Label>
            <Textarea defaultValue={meeting.actionsContent ?? ""} onChange={(e) => setActionItems(e.target.value)}
              placeholder="Liste os encaminhamentos e responsáveis..." className="text-sm resize-none" rows={3} />
          </div>
          <Button onClick={() => updateMutation.mutate({
            id,
            minutesContent: minutes || meeting.minutesContent || "",
            decisionsContent: decisions || meeting.decisionsContent || "",
            actionsContent: actionItems || meeting.actionsContent || ""
          })} className="bg-[#1B3A8C] hover:bg-[#122970]" size="sm" disabled={updateMutation.isPending}>
            Salvar Ata
          </Button>
        </CardContent>
      </Card>

      {/* Invites */}
      {(invites ?? []).length > 0 && (
        <Card className="border border-gray-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-gray-800">Confirmações de Presença</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(invites ?? []).map((inv) => (
                <div key={inv.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-700">{inv.participantName ?? "—"}</span>
                  <Badge className={`text-xs ${inv.status === "confirmado" ? "bg-green-100 text-green-700" : inv.status === "recusado" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                    {inv.status === "confirmado" ? "Confirmado" : inv.status === "recusado" ? "Recusado" : "Pendente"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Teams Attendance */}
      {meeting.teamsMeetingId && (
        <Card className="border border-[#0078D4]/20 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
                <Users2 size={16} className="text-[#0078D4]" />
                Presença Real (Microsoft Teams)
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-xs border-[#0078D4] text-[#0078D4] hover:bg-[#E8F0FA]"
                disabled={isSyncingAttendance}
                onClick={() => { setIsSyncingAttendance(true); syncAttendanceMutation.mutate({ meetingId: id }); }}
              >
                <RefreshCw size={12} className={isSyncingAttendance ? 'animate-spin' : ''} />
                {isSyncingAttendance ? 'Sincronizando...' : 'Sincronizar Presença'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {(!attendance || attendance.length === 0) ? (
              <div className="text-center py-6 text-gray-400 text-sm">
                <Users2 size={28} className="mx-auto mb-2 opacity-30" />
                <p>Nenhum dado de presença disponível.</p>
                <p className="text-xs mt-1">Clique em "Sincronizar Presença" após o encerramento da reunião.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4 mb-3 text-sm">
                  <span className="text-gray-500">{attendance.length} participante(s) registrado(s)</span>
                  <span className="text-green-600 font-medium">
                    {attendance.filter(a => a.attended).length} presente(s)
                  </span>
                  <span className="text-gray-400">
                    Taxa: {attendance.length > 0 ? Math.round((attendance.filter(a => a.attended).length / attendance.length) * 100) : 0}%
                  </span>
                </div>
                <div className="space-y-2">
                  {attendance.map((rec) => (
                    <div key={rec.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{rec.participantName ?? '—'}</p>
                        <p className="text-xs text-gray-400">{rec.participantEmail}</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        {rec.durationMinutes != null && (
                          <span>{rec.durationMinutes} min</span>
                        )}
                        <Badge className={`text-xs ${
                          rec.attended ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {rec.attended ? 'Presente' : 'Ausente'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
