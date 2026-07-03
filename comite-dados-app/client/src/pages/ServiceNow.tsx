import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, ExternalLink, Ticket, CalendarDays, Filter, X, AlertTriangle } from "lucide-react";

// Mapeamento canônico de status → label em português
const STATUS_LABELS: Record<string, string> = {
  novo: "Novo",
  em_andamento: "Em Andamento",
  em_analise: "Em Análise",
  pendente: "Pendente",
  resolvido: "Resolvido",
  fechado: "Fechado",
  cancelado: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  novo: "bg-blue-100 text-blue-700",
  em_andamento: "bg-amber-100 text-amber-700",
  em_analise: "bg-purple-100 text-purple-700",
  pendente: "bg-orange-100 text-orange-700",
  resolvido: "bg-green-100 text-green-700",
  fechado: "bg-gray-100 text-gray-500",
  cancelado: "bg-red-100 text-red-700",
};

const PRIORITY_LABELS: Record<string, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

const PRIORITY_COLORS: Record<string, string> = {
  critica: "bg-red-100 text-red-700",
  alta: "bg-orange-100 text-orange-700",
  media: "bg-amber-100 text-amber-700",
  baixa: "bg-green-100 text-green-700",
};

// Tickets de alta/crítica prioridade parados há mais de 7 dias
const STALE_DAYS = 7;
function getDaysSinceUpdate(updatedAt: Date | string | null | undefined): number | null {
  if (!updatedAt) return null;
  return Math.floor((Date.now() - new Date(updatedAt).getTime()) / (24 * 60 * 60 * 1000));
}
function isStaleTicket(ticket: { priority?: string | null; status?: string | null; updatedAt?: Date | string | null }): boolean {
  if (!ticket.priority || !['alta', 'critica'].includes(ticket.priority)) return false;
  if (!ticket.status || !['novo', 'em_andamento'].includes(ticket.status)) return false;
  const days = getDaysSinceUpdate(ticket.updatedAt);
  return days !== null && days >= STALE_DAYS;
}

// Contadores exibidos no topo — os 4 principais
const COUNTER_STATUSES = [
  { key: "novo", label: "Novo" },
  { key: "em_andamento", label: "Em Andamento" },
  { key: "resolvido", label: "Resolvido" },
  { key: "fechado", label: "Fechado" },
];

// Opções do select de status (inclui todos os valores possíveis)
const STATUS_OPTIONS = [
  { v: "novo", l: "Novo" },
  { v: "em_andamento", l: "Em Andamento" },
  { v: "em_analise", l: "Em Análise" },
  { v: "pendente", l: "Pendente" },
  { v: "resolvido", l: "Resolvido" },
  { v: "fechado", l: "Fechado" },
  { v: "cancelado", l: "Cancelado" },
];

type TicketForm = {
  ticketNumber: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignedTo: string;
  externalUrl: string;
  meetingId: string; // "none" ou id numérico como string
};

const emptyTicket: TicketForm = {
  ticketNumber: "",
  title: "",
  description: "",
  status: "novo",
  priority: "media",
  assignedTo: "",
  externalUrl: "",
  meetingId: "none",
};

export default function ServiceNow() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TicketForm>({ ...emptyTicket });
  const [filterMeetingId, setFilterMeetingId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterStaleOnly, setFilterStaleOnly] = useState<boolean>(false);
  const utils = trpc.useUtils();

  const { data: tickets, isLoading } = trpc.servicenow.list.useQuery({});
  const { data: meetings } = trpc.meetings.list.useQuery({});

  // Reuniões que possuem ao menos um ticket vinculado
  const meetingsWithTickets = (meetings ?? []).filter((m) =>
    (tickets ?? []).some((t) => t.meetingId === m.id)
  );

  // Tickets filtrados
  const filteredTickets = (tickets ?? []).filter((t) => {
    const matchMeeting = filterMeetingId === "all" || String(t.meetingId) === filterMeetingId;
    const matchStatus = filterStatus === "all" || t.status === filterStatus;
    const matchStale = !filterStaleOnly || isStaleTicket(t);
    return matchMeeting && matchStatus && matchStale;
  });

  const staleCount = (tickets ?? []).filter(isStaleTicket).length;
  const hasActiveFilter = filterMeetingId !== "all" || filterStatus !== "all" || filterStaleOnly;

  const createMutation = trpc.servicenow.create.useMutation({
    onSuccess: () => {
      utils.servicenow.list.invalidate();
      toast.success("Ticket registrado!");
      setShowForm(false);
      setForm({ ...emptyTicket });
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const updateMutation = trpc.servicenow.update.useMutation({
    onSuccess: () => {
      utils.servicenow.list.invalidate();
      toast.success("Ticket atualizado!");
    },
  });

  const handleCreate = () => {
    if (!form.ticketNumber || !form.title) {
      toast.error("Número e título são obrigatórios");
      return;
    }
    createMutation.mutate({
      ticketNumber: form.ticketNumber,
      title: form.title,
      description: form.description || undefined,
      status: form.status,
      priority: form.priority,
      assignedTo: form.assignedTo || undefined,
      externalUrl: form.externalUrl || undefined,
      meetingId: form.meetingId !== "none" ? Number(form.meetingId) : undefined,
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ServiceNow</h1>
          <p className="text-sm text-gray-500 mt-0.5">Integração e rastreamento de tickets</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-[#1B3A8C] hover:bg-[#122970] gap-2">
          <Plus size={16} /> Novo Ticket
        </Button>
      </div>

      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
          <Filter size={13} />
          Filtrar por:
        </div>
        {/* Filtro por reunião */}
        <Select value={filterMeetingId} onValueChange={setFilterMeetingId}>
          <SelectTrigger className="h-8 text-xs w-52 bg-white">
            <CalendarDays size={12} className="mr-1 text-[#1B3A8C]" />
            <SelectValue placeholder="Todas as reuniões" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todas as reuniões</SelectItem>
            {meetingsWithTickets.map((m) => (
              <SelectItem key={m.id} value={String(m.id)} className="text-xs">
                {m.title}
                {m.scheduledAt && (
                  <span className="ml-1 text-gray-400">
                    ({new Date(m.scheduledAt).toLocaleDateString("pt-BR")})
                  </span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Filtro por status */}
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-xs w-40 bg-white">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todos os status</SelectItem>
            {STATUS_OPTIONS.map(({ v, l }) => (
              <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Filtro: apenas tickets parados */}
        <button
          onClick={() => setFilterStaleOnly((v) => !v)}
          className={`flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium border transition-colors ${
            filterStaleOnly
              ? "bg-red-50 border-red-300 text-red-700"
              : "bg-white border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-600"
          }`}
        >
          <AlertTriangle size={12} />
          Parados{staleCount > 0 && ` (${staleCount})`}
        </button>
        {/* Botão limpar filtros */}
        {hasActiveFilter && (
          <button
            onClick={() => { setFilterMeetingId("all"); setFilterStatus("all"); setFilterStaleOnly(false); }}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"
          >
            <X size={12} /> Limpar filtros
          </button>
        )}
        {hasActiveFilter && (
          <span className="ml-auto text-xs text-gray-400">
            {filteredTickets.length} de {(tickets ?? []).length} ticket{(tickets ?? []).length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Contadores de status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {COUNTER_STATUSES.map(({ key, label }) => {
          const cnt = (tickets ?? []).filter((t) => t.status === key).length;
          return (
            <Card key={key} className="border border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-[#1B3A8C]">{cnt}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Lista de tickets */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-gray-800">Tickets Registrados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-400 text-sm">Carregando...</div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-12">
              <Ticket size={36} className="mx-auto mb-2 text-gray-200" />
              <p className="text-gray-400 text-sm">
                {hasActiveFilter ? "Nenhum ticket encontrado com os filtros aplicados" : "Nenhum ticket registrado"}
              </p>
              {hasActiveFilter && (
                <button
                  onClick={() => { setFilterMeetingId("all"); setFilterStatus("all"); }}
                  className="mt-2 text-xs text-[#1B3A8C] hover:underline"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTickets.map((ticket) => {
                const statusKey = ticket.status ?? "novo";
                const statusLabel = STATUS_LABELS[statusKey] ?? statusKey;
                const priorityLabel = PRIORITY_LABELS[ticket.priority ?? ""] ?? ticket.priority;
                return (
                  <div
                    key={ticket.id}
                    className="flex items-start justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-[#1B3A8C]">
                          {ticket.ticketNumber}
                        </span>
                        <Badge className={`text-xs ${STATUS_COLORS[statusKey] ?? "bg-gray-100 text-gray-600"}`}>
                          {statusLabel}
                        </Badge>
                        {ticket.priority && (
                          <Badge className={`text-xs ${PRIORITY_COLORS[ticket.priority] ?? "bg-gray-100 text-gray-600"}`}>
                            {priorityLabel}
                          </Badge>
                        )}
                        {isStaleTicket(ticket) && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                            ⚠ Parado há {getDaysSinceUpdate(ticket.updatedAt)} dia{getDaysSinceUpdate(ticket.updatedAt) !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-800 mt-1">{ticket.title}</p>
                      {ticket.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{ticket.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {ticket.assignedTo && (
                          <p className="text-xs text-gray-400">Atribuído a: {ticket.assignedTo}</p>
                        )}
                        {ticket.meetingTitle && (
                          <span className="inline-flex items-center gap-1 text-xs text-[#1B3A8C] bg-blue-50 px-2 py-0.5 rounded-full">
                            <CalendarDays size={11} />
                            {ticket.meetingTitle}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      {ticket.externalUrl && (
                        <a
                          href={ticket.externalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-500 hover:text-blue-700"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                      <Select
                        value={statusKey}
                        onValueChange={(v) => updateMutation.mutate({ id: ticket.id, status: v })}
                      >
                        <SelectTrigger className="h-7 text-xs w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(({ v, l }) => (
                            <SelectItem key={v} value={v} className="text-xs">
                              {l}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de novo ticket */}
      <Dialog
        open={showForm}
        onOpenChange={(v) => {
          if (!v) {
            setShowForm(false);
            setForm({ ...emptyTicket });
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#1B3A8C]">Registrar Ticket ServiceNow</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Número do Ticket *</Label>
                <Input
                  value={form.ticketNumber}
                  onChange={(e) => setForm((f) => ({ ...f, ticketNumber: e.target.value }))}
                  placeholder="INC0001234"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Prioridade</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v} className="text-sm">
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Título *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Título do ticket"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Descrição do problema ou solicitação..."
                className="text-sm resize-none"
                rows={3}
              />
            </div>

            {/* Campo Reunião de Origem */}
            <div className="space-y-1">
              <Label className="text-xs font-medium">Reunião de Origem</Label>
              <Select
                value={form.meetingId}
                onValueChange={(v) => setForm((f) => ({ ...f, meetingId: v }))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecionar reunião (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-sm text-gray-400">
                    — Nenhuma —
                  </SelectItem>
                  {(meetings ?? []).map((m) => (
                    <SelectItem key={m.id} value={String(m.id)} className="text-sm">
                      {m.title}
                      {m.scheduledAt && (
                        <span className="ml-1 text-gray-400 text-xs">
                          ({new Date(m.scheduledAt).toLocaleDateString("pt-BR")})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">Vincule este ticket à reunião onde a demanda foi levantada.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Atribuído a</Label>
                <Input
                  value={form.assignedTo}
                  onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))}
                  placeholder="Nome do responsável"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">URL no ServiceNow</Label>
                <Input
                  value={form.externalUrl}
                  onChange={(e) => setForm((f) => ({ ...f, externalUrl: e.target.value }))}
                  placeholder="https://..."
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowForm(false);
                setForm({ ...emptyTicket });
              }}
              size="sm"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              className="bg-[#1B3A8C] hover:bg-[#122970]"
              size="sm"
              disabled={createMutation.isPending}
            >
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
