import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "wouter";
import { toast } from "sonner";
import { Plus, CalendarDays, Clock, MapPin, Video, ArrowRight, Trash2, Send, AlertCircle } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  ordinaria: "Ordinária", extraordinaria: "Extraordinária", piloto: "Piloto", workshop: "Workshop",
};
const STATUS_COLORS: Record<string, string> = {
  agendada: "bg-blue-100 text-blue-700", realizada: "bg-green-100 text-green-700",
  cancelada: "bg-red-100 text-red-700", adiada: "bg-amber-100 text-amber-700",
};
const STATUS_LABELS: Record<string, string> = {
  agendada: "Agendada", realizada: "Realizada", cancelada: "Cancelada", adiada: "Adiada",
};

type MeetingForm = {
  title: string; description: string; scheduledAt: string; endAt: string;
  location: string; meetingLink: string; type: string; domainId: string;
  createInTeams: boolean;
};
type MeetingFormErrors = { title?: string; scheduledAt?: string; endAt?: string; };

const emptyForm: MeetingForm = {
  title: "", description: "", scheduledAt: "", endAt: "",
  location: "", meetingLink: "", type: "ordinaria", domainId: "none",
  createInTeams: false,
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-red-600 mt-1">
      <AlertCircle size={11} className="flex-shrink-0" />
      {message}
    </p>
  );
}

export default function Meetings() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<MeetingForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<MeetingFormErrors>({});
  const [isCheckingConflict, setIsCheckingConflict] = useState(false);

  const utils = trpc.useUtils();
  const { data: meetings, isLoading } = trpc.meetings.list.useQuery({});
  const { data: domains } = trpc.domains.list.useQuery();
  const { data: participants } = trpc.participants.list.useQuery({});
  const { data: isTeamsConfigured } = trpc.teams.isConfigured.useQuery();

  const teamsCreateMutation = trpc.teams.createMeeting.useMutation({
    onSuccess: () => {
      utils.meetings.list.invalidate();
      toast.success("Reunião vinculada ao Teams com sucesso!");
    },
    onError: (e) => toast.error("Erro ao vincular ao Teams: " + e.message),
  });

  const createMutation = trpc.meetings.create.useMutation({
    onSuccess: async (data: any) => {
      // Se solicitado, criar no Teams agora
      if (form.createInTeams && isTeamsConfigured) {
        teamsCreateMutation.mutate({ meetingId: data.id });
      }
      utils.meetings.list.invalidate();
      toast.success("Reunião criada!");
      setShowForm(false);
      setForm(emptyForm);
      setFormErrors({});
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const deleteMutation = trpc.meetings.delete.useMutation({
    onSuccess: () => { utils.meetings.list.invalidate(); toast.success("Reunião removida."); },
  });
  const sendInvitesMutation = trpc.invites.sendInvites.useMutation({
    onSuccess: (data) => toast.success(`${data.length} convite(s) enviado(s)!`),
    onError: (e) => toast.error("Erro ao enviar convites: " + e.message),
  });

  const handleFieldChange = <K extends keyof MeetingForm>(field: K, value: MeetingForm[K]) => {
    setForm(f => ({ ...f, [field]: value }));
    if (field in formErrors) {
      setFormErrors(prev => { const next = { ...prev }; delete next[field as keyof MeetingFormErrors]; return next; });
    }
  };

  const closeForm = () => { setShowForm(false); setForm(emptyForm); setFormErrors({}); };

  const handleSubmit = async () => {
    const errs: MeetingFormErrors = {};
    if (!form.title.trim()) errs.title = "Título da reunião é obrigatório.";
    if (!form.scheduledAt) errs.scheduledAt = "Data e hora de início são obrigatórias.";
    if (form.endAt && form.scheduledAt && new Date(form.endAt) <= new Date(form.scheduledAt)) {
      errs.endAt = "A data de término deve ser posterior à data de início.";
    }
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }

    // Check for scheduling conflicts
    if (form.scheduledAt) {
      setIsCheckingConflict(true);
      try {
        const conflict = await utils.meetings.checkConflict.fetch({
          scheduledAt: new Date(form.scheduledAt),
          endAt: form.endAt ? new Date(form.endAt) : undefined,
        });
        if (conflict.hasConflict) {
          setFormErrors(prev => ({
            ...prev,
            scheduledAt: `Conflito com a reunião "${conflict.conflictTitle}" agendada para ${conflict.conflictTime}.`,
          }));
          setIsCheckingConflict(false);
          return;
        }
      } catch {
        // If conflict check fails, proceed anyway
      }
      setIsCheckingConflict(false);
    }

    createMutation.mutate({
      title: form.title.trim(), description: form.description || undefined,
      scheduledAt: new Date(form.scheduledAt),
      endAt: form.endAt ? new Date(form.endAt) : undefined,
      location: form.location || undefined, meetingLink: form.meetingLink || undefined,
      type: form.type as any,
      domainId: (form.domainId && form.domainId !== "none") ? parseInt(form.domainId) : undefined,
    });
  };

  const handleSendInvites = (meetingId: number) => {
    const allIds = (participants ?? []).map(p => p.id);
    if (allIds.length === 0) { toast.error("Nenhum participante cadastrado."); return; }
    sendInvitesMutation.mutate({ meetingId, participantIds: allIds, origin: window.location.origin });
  };

  const domainMap = Object.fromEntries((domains ?? []).map(d => [d.id, d.name]));
  const upcoming = (meetings ?? []).filter(m => m.status === 'agendada');
  const past = (meetings ?? []).filter(m => m.status !== 'agendada');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reuniões</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestão de reuniões do Lucid Data Governance</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-[#1B3A8C] hover:bg-[#122970] gap-2">
          <Plus size={16} /> Nova Reunião
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div></div>
      ) : (
        <div className="space-y-6">
          {/* Upcoming */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <CalendarDays size={14} className="text-[#1B3A8C]" /> Agendadas ({upcoming.length})
            </h2>
            {upcoming.length === 0 ? (
              <Card className="border border-dashed border-gray-200">
                <CardContent className="py-10 text-center text-gray-400 text-sm">
                  <CalendarDays size={32} className="mx-auto mb-2 opacity-30" />
                  Nenhuma reunião agendada
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {upcoming.map(m => (
                  <Card key={m.id} className="border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={`text-xs ${STATUS_COLORS[m.status ?? 'agendada']}`}>{STATUS_LABELS[m.status ?? 'agendada']}</Badge>
                            <Badge variant="outline" className="text-xs">{TYPE_LABELS[m.type ?? 'ordinaria']}</Badge>
                          </div>
                          <h3 className="font-semibold text-gray-900 text-sm">{m.title}</h3>
                          {m.domainId && <p className="text-xs text-gray-500 mt-0.5">{domainMap[m.domainId]}</p>}
                        </div>
                        <button onClick={() => { if (confirm("Remover reunião?")) deleteMutation.mutate({ id: m.id }); }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <div className="space-y-1.5 mb-4">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Clock size={11} />
                          {new Date(m.scheduledAt).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {m.location && <div className="flex items-center gap-2 text-xs text-gray-500"><MapPin size={11} />{m.location}</div>}
                        {m.meetingLink && <div className="flex items-center gap-2 text-xs text-blue-600"><Video size={11} /><a href={m.meetingLink} target="_blank" className="hover:underline truncate">Link da reunião</a></div>}
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/reunioes/${m.id}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full gap-1 text-xs">
                            Ver detalhes <ArrowRight size={11} />
                          </Button>
                        </Link>
                        <Button size="sm" className="bg-[#6DC23A] hover:bg-[#5AAD2C] gap-1 text-xs"
                          onClick={() => handleSendInvites(m.id)} disabled={sendInvitesMutation.isPending}>
                          <Send size={11} /> Enviar Convites
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Past */}
          {past.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Clock size={14} className="text-gray-400" /> Histórico ({past.length})
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {past.map(m => (
                  <Card key={m.id} className="border border-gray-100 shadow-sm opacity-80">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={`text-xs ${STATUS_COLORS[m.status ?? 'realizada']}`}>{STATUS_LABELS[m.status ?? 'realizada']}</Badge>
                          </div>
                          <h3 className="font-medium text-gray-800 text-sm">{m.title}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {new Date(m.scheduledAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <Link href={`/reunioes/${m.id}`}>
                          <Button variant="ghost" size="sm" className="text-xs gap-1">Ata <ArrowRight size={11} /></Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) closeForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#1B3A8C]">Nova Reunião</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1"><span className="text-red-500">*</span> Campos obrigatórios</p>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">

            {/* Título */}
            <div className="col-span-2 space-y-1">
              <Label className={`text-xs font-medium ${formErrors.title ? "text-red-600" : ""}`}>
                Título <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.title}
                onChange={e => handleFieldChange("title", e.target.value)}
                placeholder="Ex: Lucid Data Governance - Reunião Ordinária"
                className={`h-9 text-sm ${formErrors.title ? "border-red-500 focus-visible:ring-red-400" : ""}`}
              />
              <FieldError message={formErrors.title} />
            </div>

            {/* Descrição */}
            <div className="col-span-2 space-y-1">
              <Label className="text-xs font-medium">Descrição / Pauta</Label>
              <Textarea
                value={form.description}
                onChange={e => handleFieldChange("description", e.target.value)}
                placeholder="Descreva a pauta da reunião..."
                className="text-sm resize-none"
                rows={3}
              />
            </div>

            {/* Data Início */}
            <div className="space-y-1">
              <Label className={`text-xs font-medium ${formErrors.scheduledAt ? "text-red-600" : ""}`}>
                Data e Hora Início <span className="text-red-500">*</span>
              </Label>
              <Input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={e => handleFieldChange("scheduledAt", e.target.value)}
                className={`h-9 text-sm ${formErrors.scheduledAt ? "border-red-500 focus-visible:ring-red-400" : ""}`}
              />
              <FieldError message={formErrors.scheduledAt} />
            </div>

            {/* Data Fim */}
            <div className="space-y-1">
              <Label className={`text-xs font-medium ${formErrors.endAt ? "text-red-600" : ""}`}>Data e Hora Fim</Label>
              <Input
                type="datetime-local"
                value={form.endAt}
                min={form.scheduledAt || undefined}
                onChange={e => handleFieldChange("endAt", e.target.value)}
                className={`h-9 text-sm ${formErrors.endAt ? "border-red-500 focus-visible:ring-red-400" : ""}`}
              />
              <FieldError message={formErrors.endAt} />
            </div>

            {/* Local */}
            <div className="space-y-1">
              <Label className="text-xs font-medium">Local</Label>
              <Input value={form.location} onChange={e => handleFieldChange("location", e.target.value)} placeholder="Sala de reuniões / Online" className="h-9 text-sm" />
            </div>

            {/* Link */}
            <div className="space-y-1">
              <Label className="text-xs font-medium">Link da Reunião</Label>
              <Input value={form.meetingLink} onChange={e => handleFieldChange("meetingLink", e.target.value)} placeholder="https://teams.microsoft.com/..." className="h-9 text-sm" />
            </div>

            {/* Tipo */}
            <div className="space-y-1">
              <Label className="text-xs font-medium">Tipo</Label>
              <Select value={form.type} onValueChange={v => handleFieldChange("type", v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ordinaria">Ordinária</SelectItem>
                  <SelectItem value="extraordinaria">Extraordinária</SelectItem>
                  <SelectItem value="piloto">Piloto</SelectItem>
                  <SelectItem value="workshop">Workshop</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Domínio */}
            <div className="space-y-1">
              <Label className="text-xs font-medium">Domínio</Label>
              <Select value={form.domainId} onValueChange={v => handleFieldChange("domainId", v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum domínio</SelectItem>
                  {(domains ?? []).map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Teams Toggle */}
            {isTeamsConfigured && (
              <div className="col-span-2 flex items-center space-x-2 bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                <Checkbox 
                  id="createInTeams" 
                  checked={form.createInTeams} 
                  onCheckedChange={(v) => handleFieldChange("createInTeams", !!v)}
                />
                <Label htmlFor="createInTeams" className="text-xs font-semibold text-blue-900 cursor-pointer">
                  Criar automaticamente reunião no Microsoft Teams
                </Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm} size="sm">Cancelar</Button>
            <Button onClick={handleSubmit} className="bg-[#1B3A8C] hover:bg-[#122970]" size="sm" disabled={createMutation.isPending || isCheckingConflict || teamsCreateMutation.isPending}>
              {createMutation.isPending || teamsCreateMutation.isPending ? "Processando..." : "Criar Reunião"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
