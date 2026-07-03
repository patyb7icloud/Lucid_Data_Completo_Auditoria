import { useState } from "react";
import { motion } from "framer-motion";
import {
  ShieldAlert,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

type PiaStatus = "rascunho" | "em_revisao" | "aprovado" | "rejeitado";
type RiskLevel = "baixo" | "medio" | "alto" | "critico";

const statusConfig: Record<PiaStatus, { label: string; icon: React.ElementType; className: string }> = {
  rascunho: { label: "Rascunho", icon: FileText, className: "bg-gray-100 text-gray-700 border-gray-200" },
  em_revisao: { label: "Em revisão", icon: Clock, className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  aprovado: { label: "Aprovado", icon: CheckCircle2, className: "bg-green-100 text-green-700 border-green-200" },
  rejeitado: { label: "Rejeitado", icon: XCircle, className: "bg-red-100 text-red-700 border-red-200" },
};

const riskConfig: Record<RiskLevel, { label: string; className: string }> = {
  baixo: { label: "Baixo", className: "bg-green-100 text-green-700" },
  medio: { label: "Médio", className: "bg-yellow-100 text-yellow-700" },
  alto: { label: "Alto", className: "bg-orange-100 text-orange-700" },
  critico: { label: "Crítico", className: "bg-red-100 text-red-700" },
};

const legalBasisOptions = [
  { value: "consentimento", label: "Consentimento" },
  { value: "obrigacao_legal", label: "Obrigação legal" },
  { value: "politicas_publicas", label: "Políticas públicas" },
  { value: "estudos_pesquisa", label: "Estudos e pesquisas" },
  { value: "execucao_contrato", label: "Execução de contrato" },
  { value: "exercicio_direitos", label: "Exercício de direitos" },
  { value: "protecao_vida", label: "Proteção da vida" },
  { value: "tutela_saude", label: "Tutela da saúde" },
  { value: "interesse_legitimo", label: "Interesse legítimo" },
  { value: "protecao_credito", label: "Proteção ao crédito" },
];

interface PiaFormData {
  title: string;
  assetName: string;
  status: PiaStatus;
  riskLevel: RiskLevel | "";
  purposes: string;
  legalBasis: string;
  retentionPeriod: string;
  crossBorderTransfer: boolean;
  thirdPartySharing: boolean;
  automatedDecision: boolean;
  mitigationMeasures: string;
  residualRisk: string;
  dpoRecommendation: string;
  reviewNotes: string;
}

const defaultForm: PiaFormData = {
  title: "",
  assetName: "",
  status: "rascunho",
  riskLevel: "",
  purposes: "",
  legalBasis: "",
  retentionPeriod: "",
  crossBorderTransfer: false,
  thirdPartySharing: false,
  automatedDecision: false,
  mitigationMeasures: "",
  residualRisk: "",
  dpoRecommendation: "",
  reviewNotes: "",
};

function SectionToggle({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        {title}
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && <div className="p-4 space-y-4">{children}</div>}
    </div>
  );
}

export default function PiaPage() {

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isDpo = user?.role === "admin" || user?.role === "data_steward";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<PiaFormData>(defaultForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const { data: assessments = [], refetch } = trpc.pia.list.useQuery({});

  const createPia = trpc.pia.create.useMutation({
    onSuccess: () => {
      toast.success("PIA criada", { description: "A avaliação foi criada com sucesso." });
      setDialogOpen(false);
      setForm(defaultForm);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const updatePia = trpc.pia.update.useMutation({
    onSuccess: () => {
      toast.success("PIA atualizada");
      setDialogOpen(false);
      setEditingId(null);
      setForm(defaultForm);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const deletePia = trpc.pia.delete.useMutation({
    onSuccess: () => {
      toast.success("PIA excluída");
      setDeleteConfirmId(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  function openCreate() {
    setEditingId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  }

  function openEdit(pia: (typeof assessments)[0]) {
    setEditingId(pia.id);
    setForm({
      title: pia.title ?? "",
      assetName: pia.assetName ?? "",
      status: (pia.status as PiaStatus) ?? "rascunho",
      riskLevel: (pia.riskLevel as RiskLevel) ?? "",
      purposes: pia.purposes ?? "",
      legalBasis: pia.legalBasis ?? "",
      retentionPeriod: pia.retentionPeriod ?? "",
      crossBorderTransfer: pia.crossBorderTransfer ?? false,
      thirdPartySharing: pia.thirdPartySharing ?? false,
      automatedDecision: pia.automatedDecision ?? false,
      mitigationMeasures: pia.mitigationMeasures ?? "",
      residualRisk: pia.residualRisk ?? "",
      dpoRecommendation: pia.dpoRecommendation ?? "",
      reviewNotes: pia.reviewNotes ?? "",
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    const payload = {
      ...form,
      riskLevel: (form.riskLevel || null) as RiskLevel | null,
    };
    if (editingId) {
      updatePia.mutate({ id: editingId, ...payload });
    } else {
      createPia.mutate(payload);
    }
  }

  const filtered = assessments.filter((a) => {
    const matchSearch =
      !search ||
      a.title?.toLowerCase().includes(search.toLowerCase()) ||
      a.assetName?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusCounts = assessments.reduce<Record<string, number>>((acc, a) => {
    acc[a.status ?? "rascunho"] = (acc[a.status ?? "rascunho"] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <ShieldAlert className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">PIA / DPIA</h1>
            <p className="text-sm text-gray-500">Privacy Impact Assessment — Avaliação de impacto à proteção de dados pessoais (LGPD art. 38)</p>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Avaliação
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(Object.entries(statusConfig) as [PiaStatus, typeof statusConfig[PiaStatus]][]).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <Card key={key} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter(statusFilter === key ? "all" : key)}>
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-2xl font-bold">{statusCounts[key] ?? 0}</p>
                  <p className="text-xs text-gray-500">{cfg.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar avaliações..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(statusConfig).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* LGPD Alert */}
      <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
        <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
        <div className="text-sm text-orange-800">
          <strong>Obrigação LGPD:</strong> O relatório de impacto à proteção de dados (RIPD/DPIA) é exigido pela LGPD no art. 38 para atividades de tratamento que possam gerar riscos às liberdades civis e direitos fundamentais dos titulares.
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <ShieldAlert className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhuma avaliação encontrada</p>
          <p className="text-sm mt-1">Crie uma PIA/DPIA para ativos com dados pessoais sensíveis</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((pia) => {
            const status = (pia.status ?? "rascunho") as PiaStatus;
            const risk = (pia.riskLevel ?? null) as RiskLevel | null;
            const cfg = statusConfig[status];
            const Icon = cfg.icon;
            return (
              <motion.div key={pia.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-gray-900 truncate">{pia.title}</h3>
                          <Badge variant="outline" className={`text-xs shrink-0 ${cfg.className}`}>
                            <Icon className="h-3 w-3 mr-1" />
                            {cfg.label}
                          </Badge>
                          {risk && (
                            <Badge variant="outline" className={`text-xs shrink-0 ${riskConfig[risk].className}`}>
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Risco {riskConfig[risk].label}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                          {pia.assetName && <span>Ativo: <strong>{pia.assetName}</strong></span>}
                          {pia.legalBasis && <span>Base legal: <strong>{legalBasisOptions.find(o => o.value === pia.legalBasis)?.label ?? pia.legalBasis}</strong></span>}
                          {pia.crossBorderTransfer && <span className="text-orange-600">• Transferência internacional</span>}
                          {pia.automatedDecision && <span className="text-orange-600">• Decisão automatizada</span>}
                          {pia.approvedAt && <span>Aprovado: {new Date(pia.approvedAt).toLocaleDateString("pt-BR")}</span>}
                          {pia.reviewedByName && <span>Revisor: {pia.reviewedByName}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {status === "em_revisao" && isDpo && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-200 hover:bg-green-50"
                            onClick={() => updatePia.mutate({ id: pia.id, status: "aprovado" })}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Aprovar
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => openEdit(pia)}>
                          <Edit2 className="h-4 w-4 text-gray-400" />
                        </Button>
                        {isAdmin && (
                          <Button size="icon" variant="ghost" onClick={() => setDeleteConfirmId(pia.id)}>
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingId(null); setForm(defaultForm); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar PIA/DPIA" : "Nova Avaliação de Impacto (PIA/DPIA)"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label>Título *</Label>
                <Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: PIA — Tratamento de dados de clientes" />
              </div>
              <div className="space-y-1">
                <Label>Ativo de Dados</Label>
                <Input value={form.assetName} onChange={(e) => setForm(f => ({ ...f, assetName: e.target.value }))} placeholder="Nome do ativo ou sistema" />
              </div>
              <div className="space-y-1">
                <Label>Nível de Risco</Label>
                <Select value={form.riskLevel} onValueChange={(v) => setForm(f => ({ ...f, riskLevel: v as RiskLevel }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(riskConfig).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v as PiaStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Base Legal (LGPD art. 7/11)</Label>
                <Select value={form.legalBasis} onValueChange={(v) => setForm(f => ({ ...f, legalBasis: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {legalBasisOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <SectionToggle title="Finalidades e Tratamento">
              <div className="space-y-1">
                <Label>Finalidades do Tratamento</Label>
                <Textarea value={form.purposes} onChange={(e) => setForm(f => ({ ...f, purposes: e.target.value }))} rows={3} placeholder="Descreva as finalidades do tratamento dos dados pessoais..." />
              </div>
              <div className="space-y-1">
                <Label>Período de Retenção</Label>
                <Input value={form.retentionPeriod} onChange={(e) => setForm(f => ({ ...f, retentionPeriod: e.target.value }))} placeholder="Ex: 5 anos após encerramento do contrato" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="cursor-pointer">Transferência internacional de dados</Label>
                  <Switch checked={form.crossBorderTransfer} onCheckedChange={(v) => setForm(f => ({ ...f, crossBorderTransfer: v }))} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="cursor-pointer">Compartilhamento com terceiros</Label>
                  <Switch checked={form.thirdPartySharing} onCheckedChange={(v) => setForm(f => ({ ...f, thirdPartySharing: v }))} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="cursor-pointer">Tomada de decisão automatizada</Label>
                  <Switch checked={form.automatedDecision} onCheckedChange={(v) => setForm(f => ({ ...f, automatedDecision: v }))} />
                </div>
              </div>
            </SectionToggle>

            <SectionToggle title="Gestão de Riscos">
              <div className="space-y-1">
                <Label>Medidas de Mitigação</Label>
                <Textarea value={form.mitigationMeasures} onChange={(e) => setForm(f => ({ ...f, mitigationMeasures: e.target.value }))} rows={3} placeholder="Descreva as medidas técnicas e organizacionais para mitigar riscos..." />
              </div>
              <div className="space-y-1">
                <Label>Risco Residual</Label>
                <Textarea value={form.residualRisk} onChange={(e) => setForm(f => ({ ...f, residualRisk: e.target.value }))} rows={2} placeholder="Descreva o risco residual após as medidas de mitigação..." />
              </div>
            </SectionToggle>

            <SectionToggle title="Recomendação do DPO / Revisão">
              <div className="space-y-1">
                <Label>Recomendação do DPO</Label>
                <Textarea value={form.dpoRecommendation} onChange={(e) => setForm(f => ({ ...f, dpoRecommendation: e.target.value }))} rows={3} placeholder="Recomendações e observações do encarregado de proteção de dados..." />
              </div>
              <div className="space-y-1">
                <Label>Notas da Revisão</Label>
                <Textarea value={form.reviewNotes} onChange={(e) => setForm(f => ({ ...f, reviewNotes: e.target.value }))} rows={2} placeholder="Comentários e anotações da revisão..." />
              </div>
            </SectionToggle>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={!form.title || createPia.isPending || updatePia.isPending}
            >
              {editingId ? "Salvar alterações" : "Criar avaliação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir avaliação?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deletePia.mutate({ id: deleteConfirmId })}
              disabled={deletePia.isPending}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
