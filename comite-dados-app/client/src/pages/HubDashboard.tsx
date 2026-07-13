/**
 * HubDashboard.tsx
 * Dashboard do HUB AI & Data — Nexa Playbook
 * Exibe: Métricas do portfólio, Pipeline de Gates G0-G4, Business Case e Artefatos por demanda.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  BarChart2, CheckCircle2, XCircle, Clock, AlertTriangle,
  Upload, FileText, Trash2, Plus, TrendingUp, Target,
  Layers, Activity, ChevronRight, Loader2, RefreshCw,
} from "lucide-react";

// ─── Constantes ───────────────────────────────────────────────────────────────

const GATES = ["G0", "G1", "G2", "G3", "G4"] as const;
const GATE_LABELS: Record<string, { title: string; description: string }> = {
  G0: { title: "G0 — Descoberta",       description: "Validação do problema e hipóteses iniciais" },
  G1: { title: "G1 — Avaliação",        description: "Ficha de hipótese aprovada e priorização" },
  G2: { title: "G2 — Aprovação",        description: "Business case, risk assessment e compliance" },
  G3: { title: "G3 — UAT",             description: "Testes de aceitação e validação do usuário" },
  G4: { title: "G4 — Go-Live",          description: "GMUD, handover e knowledge transfer" },
};

const DECISION_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  go:       { label: "GO",      color: "bg-green-100 text-green-700 border-green-300",   icon: CheckCircle2 },
  no_go:    { label: "NO-GO",   color: "bg-red-100 text-red-700 border-red-300",         icon: XCircle },
  pendente: { label: "Pendente", color: "bg-yellow-100 text-yellow-700 border-yellow-300", icon: Clock },
};

const ARTIFACT_TYPE_LABELS: Record<string, string> = {
  ficha_hipotese:         "Ficha de Hipótese",
  business_case:          "Business Case",
  risk_assessment:        "Risk Assessment",
  checklist_arquitetura:  "Checklist Arquitetura",
  checklist_compliance:   "Checklist Compliance",
  status_report:          "Status Report",
  uat_doc:                "Documento UAT",
  gmud:                   "GMUD",
  handover:               "Handover",
  knowledge_transfer:     "Knowledge Transfer",
  outro:                  "Outro",
};

const PHASE_LABELS: Record<string, string> = {
  descoberta_problema:      "Descoberta do Problema",
  descoberta_hipoteses:     "Descoberta de Hipóteses",
  avaliacao_hipotese:       "Avaliação da Hipótese",
  poc:                      "PoC",
  desenvolvimento_testes:   "Desenvolvimento & Testes",
  uat:                      "UAT",
  habilitacao_operacional:  "Habilitação Operacional",
  hypercare:                "Hypercare",
  lancamento_operacional:   "Lançamento Operacional",
  sustentacao:              "Sustentação",
};

// ─── Componente: Painel de Métricas ───────────────────────────────────────────

function MetricsPanel() {
  const { data, isLoading, refetch } = trpc.hub.getHubMetrics.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const metrics = data ?? {
    byStatus: [], byType: [], byTier: [],
    avgLeadTimeDays: 0, validationRate: 0, throughput90d: 0, totalActive: 0,
  };

  const STATUS_COLORS: Record<string, string> = {
    submetido: "bg-blue-500", em_triagem: "bg-yellow-500",
    aprovado_estrategico: "bg-green-500", aprovado_operacional: "bg-emerald-500",
    em_execucao: "bg-indigo-500", concluido: "bg-teal-500",
    retornado: "bg-orange-500", rejeitado: "bg-red-500",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Métricas do Portfólio HUB</h2>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg"><Activity className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Demandas Ativas</p>
                <p className="text-2xl font-bold">{metrics.totalActive}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-100 rounded-lg"><TrendingUp className="h-5 w-5 text-teal-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Lead Time Médio</p>
                <p className="text-2xl font-bold">{metrics.avgLeadTimeDays}<span className="text-sm font-normal ml-1">dias</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg"><Target className="h-5 w-5 text-green-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Taxa de Validação</p>
                <p className="text-2xl font-bold">{metrics.validationRate}<span className="text-sm font-normal ml-1">%</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg"><BarChart2 className="h-5 w-5 text-purple-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Throughput (90d)</p>
                <p className="text-2xl font-bold">{metrics.throughput90d}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Distribuição por status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Distribuição por Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {metrics.byStatus.map((s: { status: string | null; total: number | string }) => {
              const total = Number(s.total);
              const maxTotal = Math.max(...metrics.byStatus.map((x: { total: number | string }) => Number(x.total)), 1);
              const pct = Math.round((total / maxTotal) * 100);
              const statusKey = s.status ?? "outro";
              return (
                <div key={statusKey} className="flex items-center gap-3">
                  <span className="text-xs w-36 truncate capitalize">{statusKey.replace(/_/g, " ")}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${STATUS_COLORS[statusKey] ?? "bg-gray-400"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium w-6 text-right">{total}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Distribuição por tipo e tier */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Por Tipo de Demanda</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {metrics.byType.map((t: { type: string | null; total: number | string }) => (
                <Badge key={t.type ?? "outro"} variant="outline">
                  {(t.type ?? "outro").replace(/_/g, " ")} — {String(t.total)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Por Tier de Prioridade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {metrics.byTier.map((t: { tier: string | null; total: number | string }) => (
                <Badge key={t.tier ?? "sem_tier"} variant="outline">
                  {t.tier ?? "Sem Tier"} — {String(t.total)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Componente: Pipeline de Gates ────────────────────────────────────────────

function GatesPipeline({ intakeId }: { intakeId: number }) {
  const utils = trpc.useUtils();
  const { data: gates = [], isLoading } = trpc.hub.getGates.useQuery({ intakeId });
  const { data: lifecycle } = trpc.hub.getLifecycle.useQuery({ intakeId });
  const decideGate = trpc.hub.decideGate.useMutation({
    onSuccess: () => utils.hub.getGates.invalidate({ intakeId }),
  });
  const advancePhase = trpc.hub.advancePhase.useMutation({
    onSuccess: () => utils.hub.getLifecycle.invalidate({ intakeId }),
  });

  const [selectedGate, setSelectedGate] = useState<string | null>(null);
  const [decision, setDecision] = useState<"go" | "no_go" | "pendente">("go");
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const gateMap = Object.fromEntries(gates.map(g => [g.gateName, g]));

  async function handleDecide() {
    if (!selectedGate) return;
    setSubmitting(true);
    try {
      await decideGate.mutateAsync({
        intakeId,
        gateName: selectedGate as "G0" | "G1" | "G2" | "G3" | "G4",
        decision,
        comments,
      });
      setSelectedGate(null);
      setComments("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao registrar decisão";
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Fase atual do ciclo de vida */}
      {lifecycle && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Fase atual:</span>
                <Badge className="bg-blue-600 text-white">{PHASE_LABELS[lifecycle.phase] ?? lifecycle.phase}</Badge>
              </div>
              <Select
                value=""
                onValueChange={(phase) => {
                  if (phase) advancePhase.mutate({ intakeId, phase: phase as Parameters<typeof advancePhase.mutate>[0]["phase"] });
                }}
              >
                <SelectTrigger className="w-48 h-8 text-xs">
                  <SelectValue placeholder="Avançar fase..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PHASE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pipeline visual dos Gates */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {GATES.map((gate, idx) => {
          const g = gateMap[gate];
          const meta = DECISION_META[g?.decision ?? "pendente"];
          const Icon = meta.icon;
          return (
            <div key={gate} className="flex items-center gap-1">
              <button
                onClick={() => setSelectedGate(gate)}
                className={`flex flex-col items-center p-3 rounded-lg border-2 min-w-[100px] transition-all hover:shadow-md ${meta.color}`}
              >
                <Icon className="h-5 w-5 mb-1" />
                <span className="text-xs font-bold">{gate}</span>
                <span className="text-xs text-center leading-tight mt-1">{GATE_LABELS[gate].title.split("—")[1]?.trim()}</span>
                <Badge variant="outline" className={`mt-2 text-xs ${meta.color}`}>{meta.label}</Badge>
              </button>
              {idx < GATES.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* Histórico de decisões */}
      {gates.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Histórico de Decisões</h4>
          {gates.map(g => {
            const meta = DECISION_META[g.decision ?? "pendente"];
            const Icon = meta.icon;
            return (
              <div key={g.id} className={`flex items-start gap-3 p-3 rounded-lg border ${meta.color}`}>
                <Icon className="h-4 w-4 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{g.gateName}</span>
                    <Badge variant="outline" className={`text-xs ${meta.color}`}>{meta.label}</Badge>
                    {g.approvedByName && <span className="text-xs text-muted-foreground">por {g.approvedByName}</span>}
                  </div>
                  {g.comments && <p className="text-xs mt-1 text-muted-foreground">{g.comments}</p>}
                  {g.decidedAt && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(g.decidedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de decisão */}
      <Dialog open={!!selectedGate} onOpenChange={() => setSelectedGate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Decisão — {selectedGate}</DialogTitle>
          </DialogHeader>
          {selectedGate && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">{GATE_LABELS[selectedGate]?.description}</p>
              <div className="space-y-2">
                <Label>Decisão</Label>
                <Select value={decision} onValueChange={(v) => setDecision(v as typeof decision)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="go">GO — Aprovado</SelectItem>
                    <SelectItem value="no_go">NO-GO — Reprovado</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Comentários</Label>
                <Textarea
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  placeholder="Justificativa da decisão..."
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setSelectedGate(null)}>Cancelar</Button>
                <Button onClick={handleDecide} disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Confirmar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Componente: Business Case ────────────────────────────────────────────────

function BusinessCasePanel({ intakeId }: { intakeId: number }) {
  const utils = trpc.useUtils();
  const { data: bc, isLoading } = trpc.hub.getBusinessCase.useQuery({ intakeId });
  const upsert = trpc.hub.upsertBusinessCase.useMutation({
    onSuccess: () => utils.hub.getBusinessCase.invalidate({ intakeId }),
  });

  const [capex, setCapex] = useState("");
  const [opexMonthly, setOpexMonthly] = useState("");
  const [roiMonths, setRoiMonths] = useState("");
  const [intangible, setIntangible] = useState("");
  const [saving, setSaving] = useState(false);

  const opexAnnual = parseFloat(opexMonthly || "0") * 12;

  async function handleSave() {
    setSaving(true);
    try {
      await upsert.mutateAsync({
        intakeId,
        capexTotal: parseFloat(capex) || undefined,
        opexMonthly: parseFloat(opexMonthly) || undefined,
        opexAnnual: opexAnnual || undefined,
        estimatedRoiMonths: parseInt(roiMonths) || undefined,
        intangibleBenefits: intangible || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CAPEX */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">CAPEX Total (R$)</CardTitle>
          </CardHeader>
          <CardContent>
            {bc?.capexTotal != null ? (
              <p className="text-2xl font-bold text-blue-700">
                {bc.capexTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">Não informado</p>
            )}
          </CardContent>
        </Card>
        {/* OPEX */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">OPEX Anual (R$)</CardTitle>
          </CardHeader>
          <CardContent>
            {bc?.opexAnnual != null ? (
              <p className="text-2xl font-bold text-orange-700">
                {bc.opexAnnual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">Não informado</p>
            )}
          </CardContent>
        </Card>
        {/* ROI */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">ROI Estimado</CardTitle>
          </CardHeader>
          <CardContent>
            {bc?.estimatedRoiMonths != null ? (
              <p className="text-2xl font-bold text-green-700">{bc.estimatedRoiMonths} meses</p>
            ) : (
              <p className="text-muted-foreground text-sm">Não calculado</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Formulário de edição */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Atualizar Business Case</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">CAPEX Total (R$)</Label>
              <Input
                type="number"
                placeholder="Ex: 150000"
                value={capex}
                onChange={e => setCapex(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">OPEX Mensal (R$)</Label>
              <Input
                type="number"
                placeholder="Ex: 8000"
                value={opexMonthly}
                onChange={e => setOpexMonthly(e.target.value)}
              />
              {opexMonthly && (
                <p className="text-xs text-muted-foreground">
                  Anual: {opexAnnual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">ROI Estimado (meses)</Label>
              <Input
                type="number"
                placeholder="Ex: 18"
                value={roiMonths}
                onChange={e => setRoiMonths(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Benefícios Intangíveis</Label>
            <Textarea
              placeholder="Descreva os benefícios não financeiros (redução de risco, conformidade LGPD, reputação...)"
              value={intangible}
              onChange={e => setIntangible(e.target.value)}
              rows={3}
            />
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar Business Case
          </Button>
        </CardContent>
      </Card>

      {/* Benefícios intangíveis salvos */}
      {bc?.intangibleBenefits && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-800">Benefícios Intangíveis</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-green-900">{bc.intangibleBenefits}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Componente: Artefatos ────────────────────────────────────────────────────

function ArtifactsPanel({ intakeId }: { intakeId: number }) {
  const utils = trpc.useUtils();
  const { data: artifacts = [], isLoading } = trpc.hub.listArtifacts.useQuery({ intakeId });
  const addArtifact = trpc.hub.addArtifact.useMutation({
    onSuccess: () => utils.hub.listArtifacts.invalidate({ intakeId }),
  });
  const removeArtifact = trpc.hub.removeArtifact.useMutation({
    onSuccess: () => utils.hub.listArtifacts.invalidate({ intakeId }),
  });

  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<string>("ficha_hipotese");
  const [title, setTitle] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await addArtifact.mutateAsync({
        intakeId,
        artifactType: type as Parameters<typeof addArtifact.mutate>[0]["artifactType"],
        title,
        fileUrl: fileUrl || undefined,
        notes: notes || undefined,
      });
      setTitle(""); setFileUrl(""); setNotes(""); setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Artefatos Obrigatórios por Gate</h4>
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>

      {showForm && (
        <Card className="border-dashed">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tipo de Artefato</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ARTIFACT_TYPE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Título</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nome do artefato" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">URL do Arquivo (opcional)</Label>
              <Input value={fileUrl} onChange={e => setFileUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Observações</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Notas adicionais..." />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={saving || !title.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-1" />}
                Salvar Artefato
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {artifacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
          <FileText className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">Nenhum artefato cadastrado.</p>
          <p className="text-xs mt-1">Adicione os artefatos obrigatórios para liberar os Gates.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {artifacts.map(a => (
            <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
              <FileText className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{a.title}</span>
                  <Badge variant="outline" className="text-xs">{ARTIFACT_TYPE_LABELS[a.artifactType] ?? a.artifactType}</Badge>
                </div>
                {a.notes && <p className="text-xs text-muted-foreground mt-0.5">{a.notes}</p>}
                {a.fileUrl && (
                  <a href={a.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-0.5 block">
                    Abrir arquivo
                  </a>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Enviado por {a.uploadedByName ?? "sistema"} em {new Date(a.uploadedAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                onClick={() => removeArtifact.mutate({ id: a.id })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function HubDashboard() {
  const { data: intakeList = [], isLoading: loadingIntake } = trpc.intake.list.useQuery({});
  const [selectedIntakeId, setSelectedIntakeId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("metricas");

  const selectedIntake = intakeList.find((i: { id: number }) => i.id === selectedIntakeId);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-primary" />
            HUB AI & Data
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Portfólio de demandas — Gates G0-G4, Business Case e Artefatos
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="metricas">Métricas</TabsTrigger>
          <TabsTrigger value="gates">Gates</TabsTrigger>
          <TabsTrigger value="business_case">Business Case</TabsTrigger>
          <TabsTrigger value="artefatos">Artefatos</TabsTrigger>
        </TabsList>

        {/* ── Métricas ── */}
        <TabsContent value="metricas" className="mt-6">
          <MetricsPanel />
        </TabsContent>

        {/* ── Gates / Business Case / Artefatos — requerem seleção de demanda ── */}
        {(["gates", "business_case", "artefatos"] as const).map(tab => (
          <TabsContent key={tab} value={tab} className="mt-6 space-y-4">
            {/* Seletor de demanda */}
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-3">
                  <Label className="text-sm whitespace-nowrap">Selecionar demanda:</Label>
                  {loadingIntake ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Select
                      value={selectedIntakeId?.toString() ?? ""}
                      onValueChange={(v) => setSelectedIntakeId(parseInt(v))}
                    >
                      <SelectTrigger className="max-w-sm">
                        <SelectValue placeholder="Escolha uma demanda..." />
                      </SelectTrigger>
                      <SelectContent>
                        {intakeList.map((i: { id: number; title: string; status: string }) => (
                          <SelectItem key={i.id} value={i.id.toString()}>
                            #{i.id} — {i.title} ({i.status})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {selectedIntake && (
                    <Badge variant="outline" className="text-xs">
                      {selectedIntake.status}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {!selectedIntakeId ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">Selecione uma demanda acima para visualizar os detalhes.</p>
              </div>
            ) : (
              <>
                {tab === "gates" && <GatesPipeline intakeId={selectedIntakeId} />}
                {tab === "business_case" && <BusinessCasePanel intakeId={selectedIntakeId} />}
                {tab === "artefatos" && <ArtifactsPanel intakeId={selectedIntakeId} />}
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
