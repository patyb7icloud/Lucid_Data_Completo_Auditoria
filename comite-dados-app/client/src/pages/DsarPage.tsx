import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Clock, CheckCircle2, XCircle, Loader2, Trash2, UserCheck } from "lucide-react";
import { format, differenceInDays, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────
type RequestType =
  | "acesso"
  | "retificacao"
  | "exclusao"
  | "portabilidade"
  | "oposicao"
  | "revogacao_consentimento";

type DsarStatus = "aberto" | "em_andamento" | "concluido" | "rejeitado";

const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  acesso: "Acesso",
  retificacao: "Retificação",
  exclusao: "Exclusão",
  portabilidade: "Portabilidade",
  oposicao: "Oposição",
  revogacao_consentimento: "Revogação de Consentimento",
};

const STATUS_CONFIG: Record<DsarStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: React.ReactNode }> = {
  aberto: { label: "Aberto", variant: "default", icon: <Clock className="w-3 h-3" /> },
  em_andamento: { label: "Em Andamento", variant: "secondary", icon: <Loader2 className="w-3 h-3" /> },
  concluido: { label: "Concluído", variant: "outline", icon: <CheckCircle2 className="w-3 h-3" /> },
  rejeitado: { label: "Rejeitado", variant: "destructive", icon: <XCircle className="w-3 h-3" /> },
};

// ─── Deadline countdown ───────────────────────────────────────────────────────
function DeadlineBadge({ deadline }: { deadline: string | Date | null | undefined }) {
  if (!deadline) return null;
  const d = new Date(deadline);
  const days = differenceInDays(d, new Date());
  const expired = isPast(d);
  if (expired)
    return <span className="text-xs font-medium text-red-600 dark:text-red-400">Prazo expirado ({format(d, "dd/MM/yyyy")})</span>;
  const color = days <= 5 ? "text-red-600 dark:text-red-400" : days <= 10 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground";
  return (
    <span className={`text-xs font-medium ${color}`}>
      {days}d restantes · vence {format(d, "dd/MM/yyyy", { locale: ptBR })}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DsarPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [detailItem, setDetailItem] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state for create
  const [form, setForm] = useState({
    requestType: "acesso" as RequestType,
    subjectName: "",
    subjectEmail: "",
    subjectDocument: "",
    description: "",
    assignedToName: "",
  });

  // Detail/edit form
  const [detailForm, setDetailForm] = useState({
    status: "aberto" as DsarStatus,
    internalNotes: "",
    responseDetails: "",
    assignedToName: "",
  });

  const utils = trpc.useUtils();

  const { data: requests = [], isLoading } = trpc.dsar.list.useQuery(
    statusFilter === "all" && typeFilter === "all"
      ? undefined
      : {
          status: statusFilter !== "all" ? statusFilter : undefined,
          requestType: typeFilter !== "all" ? typeFilter : undefined,
        }
  );

  const createMut = trpc.dsar.create.useMutation({
    onSuccess: () => { utils.dsar.list.invalidate(); setDialogOpen(false); resetForm(); },
  });
  const updateMut = trpc.dsar.update.useMutation({
    onSuccess: () => { utils.dsar.list.invalidate(); setDetailItem(null); },
  });
  const deleteMut = trpc.dsar.delete.useMutation({
    onSuccess: () => { utils.dsar.list.invalidate(); setDeleteId(null); },
  });

  function resetForm() {
    setForm({ requestType: "acesso", subjectName: "", subjectEmail: "", subjectDocument: "", description: "", assignedToName: "" });
    setEditItem(null);
  }

  function openDetail(item: any) {
    setDetailItem(item);
    setDetailForm({
      status: item.status,
      internalNotes: item.internalNotes ?? "",
      responseDetails: item.responseDetails ?? "",
      assignedToName: item.assignedToName ?? "",
    });
  }

  async function handleCreate() {
    if (!form.subjectName || !form.subjectEmail) return;
    setSaving(true);
    try {
      await createMut.mutateAsync({
        requestType: form.requestType,
        subjectName: form.subjectName,
        subjectEmail: form.subjectEmail,
        subjectDocument: form.subjectDocument || null,
        description: form.description || null,
        assignedToName: form.assignedToName || null,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateDetail() {
    if (!detailItem) return;
    setSaving(true);
    try {
      await updateMut.mutateAsync({
        id: detailItem.id,
        status: detailForm.status,
        internalNotes: detailForm.internalNotes || null,
        responseDetails: detailForm.responseDetails || null,
        assignedToName: detailForm.assignedToName || null,
      });
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return requests;
    const q = search.toLowerCase();
    return requests.filter((r: any) =>
      r.subjectName?.toLowerCase().includes(q) ||
      r.subjectEmail?.toLowerCase().includes(q) ||
      r.subjectDocument?.toLowerCase().includes(q)
    );
  }, [requests, search]);

  // Stats
  const stats = useMemo(() => ({
    aberto: requests.filter((r: any) => r.status === "aberto").length,
    em_andamento: requests.filter((r: any) => r.status === "em_andamento").length,
    concluido: requests.filter((r: any) => r.status === "concluido").length,
    rejeitado: requests.filter((r: any) => r.status === "rejeitado").length,
  }), [requests]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-primary" />
            DSAR — Direitos do Titular
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Solicitações de acesso, correção, exclusão e portabilidade de dados (LGPD art. 18)
          </p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Solicitação
        </Button>
      </div>

      {/* LGPD banner */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
        <strong>LGPD art. 18–19:</strong> Todas as solicitações devem ser respondidas em até <strong>30 dias</strong>. O contador de prazo começa na criação da solicitação.
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["aberto", "em_andamento", "concluido", "rejeitado"] as DsarStatus[]).map((s) => {
          const cfg = STATUS_CONFIG[s];
          return (
            <Card
              key={s}
              className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary ${statusFilter === s ? "ring-2 ring-primary" : ""}`}
              onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
            >
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{cfg.label}</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <p className="text-2xl font-bold">{stats[s]}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, e-mail ou documento..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Tipo de solicitação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(REQUEST_TYPE_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table / List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          Nenhuma solicitação encontrada.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r: any) => {
            const cfg = STATUS_CONFIG[r.status as DsarStatus];
            return (
              <Card
                key={r.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => openDetail(r)}
              >
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{r.subjectName}</span>
                      <Badge variant={cfg.variant} className="gap-1 text-xs">
                        {cfg.icon}{cfg.label}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {REQUEST_TYPE_LABELS[r.requestType as RequestType] ?? r.requestType}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{r.subjectEmail}{r.subjectDocument ? ` · ${r.subjectDocument}` : ""}</p>
                    {r.description && <p className="text-sm mt-1 text-foreground/70 line-clamp-1">{r.description}</p>}
                    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Criado em {r.createdAt ? format(new Date(r.createdAt), "dd/MM/yyyy", { locale: ptBR }) : "—"}</span>
                      {r.assignedToName && <span>Atribuído a <strong>{r.assignedToName}</strong></span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <DeadlineBadge deadline={r.deadline} />
                    {isAdmin && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteId(r.id); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); resetForm(); } else setDialogOpen(true); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Solicitação DSAR</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Tipo de solicitação *</Label>
              <Select value={form.requestType} onValueChange={(v) => setForm({ ...form, requestType: v as RequestType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(REQUEST_TYPE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome do titular *</Label>
                <Input value={form.subjectName} onChange={(e) => setForm({ ...form, subjectName: e.target.value })} placeholder="Nome completo" />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail *</Label>
                <Input type="email" value={form.subjectEmail} onChange={(e) => setForm({ ...form, subjectEmail: e.target.value })} placeholder="email@exemplo.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>CPF / Documento</Label>
              <Input value={form.subjectDocument} onChange={(e) => setForm({ ...form, subjectDocument: e.target.value })} placeholder="000.000.000-00" />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição da solicitação</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descreva o que o titular está solicitando..." rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label>Atribuir a (nome do responsável)</Label>
              <Input value={form.assignedToName} onChange={(e) => setForm({ ...form, assignedToName: e.target.value })} placeholder="Responsável pelo atendimento" />
            </div>
            <p className="text-xs text-muted-foreground">O prazo de 30 dias (LGPD) será calculado automaticamente a partir da data de criação.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving || !form.subjectName || !form.subjectEmail}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailItem} onOpenChange={(o) => { if (!o) setDetailItem(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Solicitação #{detailItem?.id} — {REQUEST_TYPE_LABELS[detailItem?.requestType as RequestType] ?? detailItem?.requestType}
            </DialogTitle>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-4 py-2">
              {/* Titular info (read-only) */}
              <div className="rounded-lg border p-3 bg-muted/30 space-y-1 text-sm">
                <p><strong>Titular:</strong> {detailItem.subjectName}</p>
                <p><strong>E-mail:</strong> {detailItem.subjectEmail}</p>
                {detailItem.subjectDocument && <p><strong>Documento:</strong> {detailItem.subjectDocument}</p>}
                {detailItem.description && <p><strong>Descrição:</strong> {detailItem.description}</p>}
                <p><strong>Criado em:</strong> {detailItem.createdAt ? format(new Date(detailItem.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}</p>
                <DeadlineBadge deadline={detailItem.deadline} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={detailForm.status} onValueChange={(v) => setDetailForm({ ...detailForm, status: v as DsarStatus })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aberto">Aberto</SelectItem>
                      <SelectItem value="em_andamento">Em Andamento</SelectItem>
                      <SelectItem value="concluido">Concluído</SelectItem>
                      <SelectItem value="rejeitado">Rejeitado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Atribuído a</Label>
                  <Input value={detailForm.assignedToName} onChange={(e) => setDetailForm({ ...detailForm, assignedToName: e.target.value })} placeholder="Responsável" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Notas internas</Label>
                <Textarea value={detailForm.internalNotes} onChange={(e) => setDetailForm({ ...detailForm, internalNotes: e.target.value })} rows={3} placeholder="Notas internas (não visíveis ao titular)..." />
              </div>
              <div className="space-y-1.5">
                <Label>Resposta ao titular</Label>
                <Textarea value={detailForm.responseDetails} onChange={(e) => setDetailForm({ ...detailForm, responseDetails: e.target.value })} rows={3} placeholder="Detalhe a resposta fornecida ao titular..." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailItem(null)}>Fechar</Button>
            <Button onClick={handleUpdateDetail} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir solicitação?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. A solicitação e todos os seus dados serão removidos permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId !== null && deleteMut.mutate({ id: deleteId })}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
