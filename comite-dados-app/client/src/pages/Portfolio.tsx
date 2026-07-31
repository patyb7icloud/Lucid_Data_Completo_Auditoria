/**
 * Portfolio.tsx
 * Módulo 3: Portfólio de Iniciativas & Gates
 * Endereça: R16 (certificados Entra ID), R23 (portfólio sem metadados), R26 (gates Fase II), R27 (rastreabilidade)
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  FolderKanban, Plus, ChevronRight, CheckCircle2, Clock,
  AlertTriangle, GitBranch, ArrowRight, Users, Target,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// ─── Constantes ───────────────────────────────────────────────────────────────
const PHASE_CONFIG: Record<string, { label: string; color: string; bg: string; order: number }> = {
  ideacao:       { label: "Ideação",       color: "#6b7280", bg: "#f3f4f6", order: 1 },
  poc:           { label: "PoC",           color: "#2563eb", bg: "#dbeafe", order: 2 },
  piloto:        { label: "Piloto",        color: "#d97706", bg: "#fef3c7", order: 3 },
  rollout:       { label: "Rollout",       color: "#7c3aed", bg: "#ede9fe", order: 4 },
  producao:      { label: "Produção",      color: "#16a34a", bg: "#dcfce7", order: 5 },
  descontinuada: { label: "Descontinuada", color: "#dc2626", bg: "#fee2e2", order: 6 },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  rascunho:        { label: "Rascunho",         color: "#6b7280" },
  em_andamento:    { label: "Em Andamento",      color: "#2563eb" },
  aguardando_gate: { label: "Aguardando Gate",   color: "#d97706" },
  aprovada:        { label: "Aprovada",          color: "#16a34a" },
  pausada:         { label: "Pausada",           color: "#ea580c" },
  cancelada:       { label: "Cancelada",         color: "#dc2626" },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  critica: { label: "Crítica", color: "#dc2626" },
  alta:    { label: "Alta",    color: "#ea580c" },
  media:   { label: "Média",   color: "#d97706" },
  baixa:   { label: "Baixa",   color: "#16a34a" },
};

const PHASE_ORDER = ["ideacao", "poc", "piloto", "rollout", "producao"];
const NEXT_PHASE: Record<string, string> = {
  ideacao: "poc", poc: "piloto", piloto: "rollout", rollout: "producao",
};

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function Portfolio() {
  const [openCreate, setOpenCreate] = useState(false);
  const [openGate, setOpenGate] = useState<{ id: number; currentPhase: string } | null>(null);
  const [gateApprovedBy, setGateApprovedBy] = useState("");
  const [gateNotes, setGateNotes] = useState("");
  const [checklist, setChecklist] = useState<{ id: number; item: string; checked: boolean }[]>([]);
  const [filterPhase, setFilterPhase] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    title: "", description: "", initiativeType: "", phase: "ideacao",
    status: "rascunho", priority: "media", businessOwnerName: "",
    aiModelOwnerName: "", domainName: "", squad: "", riskLevel: "nao_avaliado",
    mipSensitivity: "", notes: "",
  });

  const kpis        = trpc.portfolio.getPortfolioKpis.useQuery();
  const initiatives = trpc.portfolio.listInitiatives.useQuery({
    phase:  filterPhase  ? filterPhase  as any : undefined,
    status: filterStatus ? filterStatus as any : undefined,
    search: search || undefined,
  });

  const createMutation  = trpc.portfolio.createInitiative.useMutation();
  const advanceMutation = trpc.portfolio.advanceGate.useMutation();
  const utils = trpc.useUtils();

  // Buscar checklist quando o dialog de gate abre
  const gateChecklistQuery = trpc.portfolio.getGateChecklist.useQuery(
    { toPhase: openGate ? (NEXT_PHASE[openGate.currentPhase] ?? "") : "" },
    { enabled: !!openGate }
  );

  const handleCreate = async () => {
    if (!form.title.trim()) { toast.error("Título é obrigatório"); return; }
    try {
      await createMutation.mutateAsync(form as any);
      toast.success("Iniciativa cadastrada com sucesso");
      setOpenCreate(false);
      utils.portfolio.invalidate();
    } catch (e: any) { toast.error(e.message ?? "Erro ao cadastrar iniciativa"); }
  };

  const handleOpenGate = (id: number, currentPhase: string) => {
    setOpenGate({ id, currentPhase });
    setGateApprovedBy("");
    setGateNotes("");
    const items = gateChecklistQuery.data ?? [];
    setChecklist(items.map(i => ({ ...i, checked: false })));
  };

  const handleAdvanceGate = async () => {
    if (!openGate) return;
    if (!gateApprovedBy.trim()) { toast.error("Responsável pela aprovação é obrigatório"); return; }
    const toPhase = NEXT_PHASE[openGate.currentPhase];
    if (!toPhase) { toast.error("Não há próxima fase disponível"); return; }
    try {
      await advanceMutation.mutateAsync({
        initiativeId:  openGate.id,
        toPhase:       toPhase as any,
        approvedBy:    gateApprovedBy,
        checklistJson: JSON.stringify(checklist),
        notes:         gateNotes,
      });
      toast.success(`Iniciativa avançada para ${PHASE_CONFIG[toPhase]?.label ?? toPhase}`);
      setOpenGate(null);
      utils.portfolio.invalidate();
    } catch (e: any) { toast.error(e.message ?? "Erro ao avançar gate"); }
  };

  const kpiData = kpis.data;
  const phaseChartData = PHASE_ORDER.map(p => ({
    name: PHASE_CONFIG[p]?.label ?? p,
    total: kpiData?.porFase?.[p as keyof typeof kpiData.porFase] ?? 0,
  }));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FolderKanban className="w-7 h-7 text-[#6DC23A]" />
            Portfólio de Iniciativas
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Gestão de Projetos de Dados e IA com Workflow de Gates — Ideação → PoC → Piloto → Rollout → Produção
          </p>
        </div>
        <Button onClick={() => setOpenCreate(true)} className="bg-[#6DC23A] hover:bg-[#5aaa30] text-white">
          <Plus className="w-4 h-4 mr-2" /> Nova Iniciativa
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Total",           value: kpiData?.total ?? 0,          icon: FolderKanban, color: "text-[#6DC23A]" },
          { label: "Em Andamento",    value: kpiData?.emAndamento ?? 0,    icon: GitBranch,    color: "text-blue-600" },
          { label: "Aguard. Gate",    value: kpiData?.aguardandoGate ?? 0, icon: Clock,        color: "text-orange-500" },
          { label: "Críticas/Altas",  value: kpiData?.criticas ?? 0,       icon: AlertTriangle,color: "text-red-600" },
          { label: "Sem Owner",       value: kpiData?.semOwner ?? 0,       icon: Users,        color: "text-orange-500" },
          { label: "Em Produção",     value: kpiData?.producao ?? 0,       icon: CheckCircle2, color: "text-green-600" },
        ].map((kpi) => (
          <Card key={kpi.label} className="border border-gray-200">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{kpi.label}</span>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <div className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="kanban">
        <TabsList>
          <TabsTrigger value="kanban">Portfólio</TabsTrigger>
          <TabsTrigger value="gates">
            Aguardando Gate
            {(kpiData?.aguardandoGate ?? 0) > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs">{kpiData?.aguardandoGate}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Portfólio */}
        <TabsContent value="kanban" className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <Input
              placeholder="Buscar iniciativa..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-64"
            />
            <Select value={filterPhase} onValueChange={setFilterPhase}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Fase" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas as fases</SelectItem>
                {Object.entries(PHASE_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos os status</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            {initiatives.isLoading ? (
              <div className="text-center py-8 text-gray-400">Carregando...</div>
            ) : initiatives.data?.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <FolderKanban className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma iniciativa cadastrada</p>
                <Button onClick={() => setOpenCreate(true)} variant="outline" className="mt-3">
                  Cadastrar primeira iniciativa
                </Button>
              </div>
            ) : initiatives.data?.map(init => {
              const phase  = PHASE_CONFIG[init.phase]  ?? PHASE_CONFIG.ideacao;
              const stat   = STATUS_CONFIG[init.status] ?? STATUS_CONFIG.rascunho;
              const prio   = PRIORITY_CONFIG[init.priority] ?? PRIORITY_CONFIG.media;
              const nextPh = NEXT_PHASE[init.phase];
              return (
                <Card key={init.id} className="border border-gray-200 hover:border-[#6DC23A]/40 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">{init.title}</span>
                          <Badge style={{ backgroundColor: phase.bg, color: phase.color }} className="text-xs border-0">{phase.label}</Badge>
                          <Badge variant="outline" style={{ color: stat.color }} className="text-xs">{stat.label}</Badge>
                          <Badge variant="outline" style={{ color: prio.color }} className="text-xs">{prio.label}</Badge>
                          {init.status === "aguardando_gate" && (
                            <Badge className="text-xs bg-orange-100 text-orange-700 border-orange-300">
                              <Clock className="w-3 h-3 mr-1" />Gate Pendente
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1 truncate">{init.description ?? "—"}</p>
                        <div className="flex gap-4 mt-2 text-xs text-gray-400 flex-wrap">
                          <span>Tipo: <strong className="text-gray-600">{init.initiativeType ?? "—"}</strong></span>
                          <span>Owner: <strong className="text-gray-600">{init.businessOwnerName ?? "Não designado"}</strong></span>
                          <span>Squad: <strong className="text-gray-600">{init.squad ?? "—"}</strong></span>
                          <span>Domínio: <strong className="text-gray-600">{init.domainName ?? "—"}</strong></span>
                          {init.gateApprovedBy && (
                            <span>Último Gate: <strong className="text-gray-600">{init.gateApprovedBy}</strong></span>
                          )}
                        </div>
                        {/* Barra de progresso de fase */}
                        <div className="flex items-center gap-1 mt-3">
                          {PHASE_ORDER.map((p, idx) => {
                            const ph = PHASE_CONFIG[p];
                            const isActive = p === init.phase;
                            const isPast = PHASE_CONFIG[p].order < PHASE_CONFIG[init.phase].order;
                            return (
                              <div key={p} className="flex items-center gap-1">
                                <div
                                  className={`h-1.5 w-8 rounded-full transition-all ${
                                    isPast ? "bg-green-400" : isActive ? "bg-[#6DC23A]" : "bg-gray-200"
                                  }`}
                                />
                                {idx < PHASE_ORDER.length - 1 && (
                                  <ChevronRight className="w-3 h-3 text-gray-300" />
                                )}
                              </div>
                            );
                          })}
                          <span className="text-xs text-gray-400 ml-2">{phase.label}</span>
                        </div>
                      </div>
                      {nextPh && init.phase !== "producao" && init.phase !== "descontinuada" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[#6DC23A] hover:border-[#6DC23A] shrink-0"
                          onClick={() => handleOpenGate(init.id, init.phase)}
                        >
                          <ArrowRight className="w-4 h-4 mr-1" />
                          Avançar Gate
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Aguardando Gate */}
        <TabsContent value="gates" className="space-y-3">
          <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-700">
            <Clock className="w-4 h-4 shrink-0" />
            <span>Iniciativas aguardando aprovação formal de gate (R26). Cada gate exige checklist completo e aprovação do Data Steward.</span>
          </div>
          {initiatives.data?.filter(i => i.status === "aguardando_gate").length === 0 ? (
            <div className="text-center py-8 text-green-600">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2" />
              <p>Nenhuma iniciativa aguardando gate.</p>
            </div>
          ) : initiatives.data?.filter(i => i.status === "aguardando_gate").map(init => (
            <Card key={init.id} className="border border-orange-200">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{init.title}</p>
                  <p className="text-xs text-gray-500">
                    Fase atual: {PHASE_CONFIG[init.phase]?.label ?? init.phase} →{" "}
                    Próxima: {PHASE_CONFIG[NEXT_PHASE[init.phase] ?? ""]?.label ?? "—"}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="bg-[#6DC23A] hover:bg-[#5aaa30] text-white"
                  onClick={() => handleOpenGate(init.id, init.phase)}
                >
                  <ArrowRight className="w-4 h-4 mr-1" />Aprovar Gate
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Analytics */}
        <TabsContent value="analytics">
          <Card>
            <CardHeader><CardTitle className="text-sm">Iniciativas por Fase</CardTitle></CardHeader>
            <CardContent>
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={phaseChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="total" fill="#6DC23A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: Criar Iniciativa */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Iniciativa de Dados / IA</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2">
              <Label>Título *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Modelo de Previsão de Churn" />
            </div>
            <div className="col-span-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div>
              <Label>Tipo</Label>
              <Input value={form.initiativeType} onChange={e => setForm(f => ({ ...f, initiativeType: e.target.value }))} placeholder="Ex: Modelo ML, Agente GenAI" />
            </div>
            <div>
              <Label>Fase Inicial</Label>
              <Select value={form.phase} onValueChange={v => setForm(f => ({ ...f, phase: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PHASE_CONFIG).filter(([k]) => k !== "descontinuada").map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Business Owner</Label>
              <Input value={form.businessOwnerName} onChange={e => setForm(f => ({ ...f, businessOwnerName: e.target.value }))} />
            </div>
            <div>
              <Label>AI Model Owner</Label>
              <Input value={form.aiModelOwnerName} onChange={e => setForm(f => ({ ...f, aiModelOwnerName: e.target.value }))} />
            </div>
            <div>
              <Label>Domínio</Label>
              <Input value={form.domainName} onChange={e => setForm(f => ({ ...f, domainName: e.target.value }))} />
            </div>
            <div>
              <Label>Squad</Label>
              <Input value={form.squad} onChange={e => setForm(f => ({ ...f, squad: e.target.value }))} placeholder="Ex: Data Science" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="bg-[#6DC23A] hover:bg-[#5aaa30] text-white">
              {createMutation.isPending ? "Salvando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Avançar Gate */}
      <Dialog open={!!openGate} onOpenChange={() => setOpenGate(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Aprovação de Gate — {openGate ? `${PHASE_CONFIG[openGate.currentPhase]?.label} → ${PHASE_CONFIG[NEXT_PHASE[openGate.currentPhase] ?? ""]?.label}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Aprovado por *</Label>
              <Input
                value={gateApprovedBy}
                onChange={e => setGateApprovedBy(e.target.value)}
                placeholder="Nome do Data Steward / Responsável"
              />
            </div>
            {gateChecklistQuery.data && gateChecklistQuery.data.length > 0 && (
              <div>
                <Label className="mb-2 block">Checklist de Gate</Label>
                <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
                  {gateChecklistQuery.data.map((item, idx) => (
                    <div key={item.id} className="flex items-start gap-2">
                      <Checkbox
                        id={`check-${idx}`}
                        checked={checklist[idx]?.checked ?? false}
                        onCheckedChange={v => {
                          setChecklist(prev => {
                            const updated = [...prev];
                            if (!updated[idx]) updated[idx] = { id: item.id, item: item.item, checked: false };
                            updated[idx].checked = !!v;
                            return updated;
                          });
                        }}
                      />
                      <label htmlFor={`check-${idx}`} className="text-sm text-gray-700 cursor-pointer">{item.item}</label>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <Label>Observações</Label>
              <Textarea value={gateNotes} onChange={e => setGateNotes(e.target.value)} rows={2} placeholder="Observações sobre a aprovação..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenGate(null)}>Cancelar</Button>
            <Button
              onClick={handleAdvanceGate}
              disabled={advanceMutation.isPending}
              className="bg-[#6DC23A] hover:bg-[#5aaa30] text-white"
            >
              {advanceMutation.isPending ? "Avançando..." : "Confirmar Gate e Avançar Fase"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
