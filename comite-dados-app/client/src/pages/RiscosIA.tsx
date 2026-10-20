/**
 * RiscosIA.tsx
 * Lacuna 2: Gestão de Riscos de IA com Explicabilidade (XAI) e Conformidade
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AlertTriangle, Plus, ShieldCheck, Brain, Scale, Clock, CheckCircle2, XCircle, ShieldAlert, ClipboardCheck } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from "recharts";
import { Checkbox } from "@/components/ui/checkbox";
import { COMPLIANCE_TEMPLATES } from "@/lib/complianceTemplates";

// ─── Constantes ───────────────────────────────────────────────────────────────
const LEVEL_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  baixo:   { label: "Baixo",   color: "#16a34a", bg: "#dcfce7" },
  medio:   { label: "Médio",   color: "#d97706", bg: "#fef3c7" },
  alto:    { label: "Alto",    color: "#ea580c", bg: "#ffedd5" },
  critico: { label: "Crítico", color: "#dc2626", bg: "#fee2e2" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  aberto:        { label: "Aberto",        color: "#dc2626" },
  em_mitigacao:  { label: "Em Mitigação",  color: "#d97706" },
  mitigado:      { label: "Mitigado",      color: "#16a34a" },
  aceito:        { label: "Aceito",        color: "#6b7280" },
};

const CATEGORY_LABELS: Record<string, string> = {
  vies: "Viés", privacidade: "Privacidade", seguranca: "Segurança",
  explicabilidade: "Explicabilidade", conformidade: "Conformidade", operacional: "Operacional",
};

const CATEGORY_COLORS: Record<string, string> = {
  vies: "#dc2626", privacidade: "#8B5CF6", seguranca: "#1B3A8C",
  explicabilidade: "#F59E0B", conformidade: "#06B6D4", operacional: "#6DC23A",
};

const FRAMEWORK_LABELS: Record<string, string> = {
  lgpd: "LGPD", eu_ai_act: "EU AI Act", iso_42001: "ISO 42001", nist_ai_rmf: "NIST AI RMF",
};

const FRAMEWORK_COLORS: Record<string, string> = {
  lgpd: "#1B3A8C", eu_ai_act: "#8B5CF6", iso_42001: "#06B6D4", nist_ai_rmf: "#6DC23A",
};

// Matriz de risco 5×5 (probabilidade × impacto)
const RISK_MATRIX_COLORS = [
  ["#dcfce7","#dcfce7","#fef3c7","#fef3c7","#ffedd5"],
  ["#dcfce7","#fef3c7","#fef3c7","#ffedd5","#fee2e2"],
  ["#fef3c7","#fef3c7","#ffedd5","#fee2e2","#fee2e2"],
  ["#fef3c7","#ffedd5","#fee2e2","#fee2e2","#fecaca"],
  ["#ffedd5","#fee2e2","#fee2e2","#fecaca","#fecaca"],
];

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function RiscosIA() {
  const [tab, setTab] = useState("dashboard");
  const [showCreate, setShowCreate] = useState(false);
  const [showComplianceForm, setShowComplianceForm] = useState(false);
  const [showFairnessForm, setShowFairnessForm] = useState(false);
  const [form, setForm] = useState({
    modelName: "", title: "", description: "", category: "vies",
    level: "medio", probability: "3", impact: "3",
    xaiMethod: "", xaiSummary: "", mitigationPlan: "",
  });

  const { data: summary, refetch: refetchSummary } = trpc.aiRisk.assessments.summary.useQuery();
  const { data: risks = [], refetch: refetchRisks } = trpc.aiRisk.assessments.list.useQuery();
  const { data: fairnessAssessments = [], refetch: refetchFairness } = trpc.aiRisk.fairness.list.useQuery();

  const createRisk = trpc.aiRisk.assessments.create.useMutation({
    onSuccess: () => {
      toast.success("Risco registrado com sucesso!");
      setShowCreate(false);
      setForm({ modelName: "", title: "", description: "", category: "vies", level: "medio", probability: "3", impact: "3", xaiMethod: "", xaiSummary: "", mitigationPlan: "" });
      refetchSummary();
      refetchRisks();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateStatus = trpc.aiRisk.assessments.update.useMutation({
    onSuccess: () => { toast.success("Status atualizado!"); refetchRisks(); refetchSummary(); },
    onError: (e) => toast.error(e.message),
  });

  // Dados para gráficos
  const levelChartData = Object.entries(summary?.byLevel ?? {}).map(([k, v]) => ({
    name: LEVEL_CONFIG[k]?.label ?? k, value: v as number, fill: LEVEL_CONFIG[k]?.color ?? "#64748B",
  }));

  const categoryChartData = Object.entries(summary?.byCategory ?? {}).map(([k, v]) => ({
    name: CATEGORY_LABELS[k] ?? k, value: v as number, fill: CATEGORY_COLORS[k] ?? "#64748B",
  }));

  const radarData = Object.entries(summary?.byCategory ?? {}).map(([k, v]) => ({
    category: CATEGORY_LABELS[k] ?? k, value: v as number,
  }));

  // Pontos na matriz de risco
  const matrixPoints = risks.reduce((acc, r) => {
    const key = `${r.probability}-${r.impact}`;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  function handleCreate() {
    if (!form.modelName.trim() || !form.title.trim()) {
      toast.error("Nome do modelo e título são obrigatórios");
      return;
    }
    createRisk.mutate({
      modelName: form.modelName,
      title: form.title,
      description: form.description || undefined,
      category: form.category as never,
      level: form.level as never,
      probability: parseInt(form.probability),
      impact: parseInt(form.impact),
      xaiMethod: form.xaiMethod || undefined,
      xaiSummary: form.xaiSummary || undefined,
      mitigationPlan: form.mitigationPlan || undefined,
    });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-50">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#1B3A8C]">Gestão de Riscos de IA</h1>
              <p className="text-sm text-gray-500">Avaliação, explicabilidade (XAI) e conformidade regulatória</p>
            </div>
          </div>
          <Button onClick={() => setShowCreate(true)} className="bg-[#1B3A8C] hover:bg-[#1B3A8C]/90 gap-2">
            <Plus className="w-4 h-4" /> Registrar Risco
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total de Riscos", value: summary?.total ?? 0, color: "#1B3A8C" },
            { label: "Críticos Abertos", value: summary?.openCritical ?? 0, color: "#dc2626" },
            { label: "Score Médio", value: summary?.avgRiskScore ?? 0, color: "#d97706", suffix: "/25" },
            { label: "Em Mitigação", value: summary?.byStatus?.em_mitigacao ?? 0, color: "#ea580c" },
          ].map(({ label, value, color, suffix }) => (
            <Card key={label}>
              <CardContent className="p-4">
                <p className="text-2xl font-bold" style={{ color }}>{value}{suffix}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="matrix">Matriz de Risco</TabsTrigger>
            <TabsTrigger value="risks">Avaliações</TabsTrigger>
            <TabsTrigger value="compliance">Conformidade</TabsTrigger>
            <TabsTrigger value="fairness">Fairness</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gray-700">Riscos por Nível de Severidade</CardTitle>
                </CardHeader>
                <CardContent>
                  {levelChartData.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Nenhum risco registrado</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={levelChartData} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="value" name="Riscos" radius={[4, 4, 0, 0]}>
                          {levelChartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gray-700">Riscos por Categoria</CardTitle>
                </CardHeader>
                <CardContent>
                  {categoryChartData.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Nenhum risco registrado</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={categoryChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                          {categoryChartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                        </Pie>
                        <Tooltip />
                        <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Risk Matrix Tab */}
          <TabsContent value="matrix">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-gray-700">Matriz de Risco 5×5</CardTitle>
                <CardDescription className="text-xs">Probabilidade (eixo Y) × Impacto (eixo X) — número indica quantidade de riscos na célula</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-6 items-start">
                  <div className="flex-shrink-0">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6" />
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="w-14 text-center text-xs font-semibold text-gray-500">
                          {["Muito Baixo", "Baixo", "Médio", "Alto", "Muito Alto"][i - 1]}
                        </div>
                      ))}
                    </div>
                    {[5, 4, 3, 2, 1].map(prob => (
                      <div key={prob} className="flex items-center gap-2 mb-1">
                        <div className="w-6 text-xs font-semibold text-gray-500 text-right">{prob}</div>
                        {[1, 2, 3, 4, 5].map(impact => {
                          const count = matrixPoints[`${prob}-${impact}`] ?? 0;
                          const bg = RISK_MATRIX_COLORS[5 - prob][impact - 1];
                          return (
                            <div
                              key={impact}
                              className="w-14 h-10 rounded flex items-center justify-center text-sm font-bold border border-white/50 transition-transform hover:scale-105"
                              style={{ background: bg }}
                            >
                              {count > 0 ? (
                                <span className="text-gray-700">{count}</span>
                              ) : (
                                <span className="text-gray-300 text-xs">·</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-6" />
                      <div className="text-xs text-gray-400 text-center" style={{ width: "calc(5 * 56px + 4 * 8px)" }}>
                        ← Impacto →
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 text-xs text-gray-600">
                    <p className="font-semibold text-gray-700 mb-3">Legenda</p>
                    {[
                      { bg: "#dcfce7", label: "Baixo (1–4)" },
                      { bg: "#fef3c7", label: "Médio (5–9)" },
                      { bg: "#ffedd5", label: "Alto (10–16)" },
                      { bg: "#fee2e2", label: "Crítico (17–25)" },
                    ].map(({ bg, label }) => (
                      <div key={label} className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded" style={{ background: bg, border: "1px solid #e5e7eb" }} />
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Risks Tab */}
          <TabsContent value="risks">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Modelo</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Risco</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Categoria</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Nível</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Score</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {risks.length === 0 ? (
                        <tr><td colSpan={7} className="text-center py-12 text-gray-400">Nenhum risco registrado.</td></tr>
                      ) : risks.map((r) => {
                        const lc = LEVEL_CONFIG[r.level];
                        const sc = STATUS_CONFIG[r.status];
                        return (
                          <tr key={r.id} className="border-b hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-gray-700 font-medium text-xs">{r.modelName}</td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-800 text-sm">{r.title}</div>
                              {r.xaiMethod && <div className="text-xs text-gray-400">XAI: {r.xaiMethod}</div>}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: CATEGORY_COLORS[r.category] + "20", color: CATEGORY_COLORS[r.category] }}>
                                {CATEGORY_LABELS[r.category] ?? r.category}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: lc?.bg, color: lc?.color }}>
                                {lc?.label ?? r.level}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-700">{r.riskScore ?? "—"}/25</td>
                            <td className="px-4 py-3">
                              <span className="text-xs font-medium" style={{ color: sc?.color }}>{sc?.label ?? r.status}</span>
                            </td>
                            <td className="px-4 py-3">
                              <Select
                                value={r.status}
                                onValueChange={(v) => updateStatus.mutate({ id: r.id, status: v as never })}
                              >
                                <SelectTrigger className="h-7 text-xs w-36">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Compliance Tab */}
          <TabsContent value="compliance" className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex gap-2 items-start">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <span><strong>Readiness, não certificação:</strong> NIST AI RMF é voluntário. Scores mostram somente checks revisados e coverage; não são certificação nem parecer jurídico.</span>
            </div>
            <div className="flex justify-end mb-4">
              <Button onClick={() => setShowComplianceForm(true)} className="bg-[#1B3A8C] gap-2">
                <ShieldCheck className="w-4 h-4" /> Nova Avaliação de Conformidade
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(FRAMEWORK_LABELS).map(([fw, label]) => (
                <Card key={fw}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold" style={{ color: FRAMEWORK_COLORS[fw] }}>
                      {label}
                    </CardTitle>
                    <CardDescription className="text-xs">Verificações de conformidade registradas</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ComplianceFrameworkCard framework={fw as never} color={FRAMEWORK_COLORS[fw]} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Fairness Tab */}
          <TabsContent value="fairness" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-800">Avaliações de fairness contextual</h2>
                <p className="text-xs text-gray-500">Somente contagens agregadas e códigos pseudônimos; métricas não afirmam fairness universal.</p>
              </div>
              <Button onClick={() => setShowFairnessForm(true)} className="bg-[#1B3A8C] gap-2">
                <Scale className="w-4 h-4" /> Avaliar fairness
              </Button>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 flex gap-2 items-start">
              <ClipboardCheck className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Selection rate, statistical parity difference, disparate impact e equal opportunity são contextuais e aguardam avaliação humana. A amostra mínima é configurável; 20 é apenas uma sugestão, não uma norma.</span>
            </div>
            {fairnessAssessments.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-sm text-gray-400">Nenhuma avaliação de fairness registrada.</CardContent></Card>
            ) : fairnessAssessments.map(a => <FairnessAssessmentCard key={a.id} assessment={a} onReviewed={refetchFairness} />)}
          </TabsContent>
        </Tabs>

        {/* Dialog: Criar Risco */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Registrar Novo Risco de IA</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nome do Modelo *</Label>
                  <Input value={form.modelName} onChange={e => setForm(f => ({ ...f, modelName: e.target.value }))} placeholder="ex: fraud-detector" />
                </div>
                <div>
                  <Label>Título do Risco *</Label>
                  <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="ex: Viés racial no modelo" />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nível</Label>
                  <Select value={form.level} onValueChange={v => setForm(f => ({ ...f, level: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(LEVEL_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Probabilidade (1–5)</Label>
                  <Select value={form.probability} onValueChange={v => setForm(f => ({ ...f, probability: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Impacto (1–5)</Label>
                  <Select value={form.impact} onValueChange={v => setForm(f => ({ ...f, impact: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Método XAI</Label>
                  <Input value={form.xaiMethod} onChange={e => setForm(f => ({ ...f, xaiMethod: e.target.value }))} placeholder="ex: SHAP, LIME, Grad-CAM" />
                </div>
                <div className="flex items-end">
                  <p className="text-xs text-gray-500 pb-2">Responsável: usuário da sessão autenticada</p>
                </div>
                <div className="col-span-2">
                  <Label>Plano de Mitigação</Label>
                  <Textarea value={form.mitigationPlan} onChange={e => setForm(f => ({ ...f, mitigationPlan: e.target.value }))} placeholder="Descreva as ações de mitigação planejadas..." rows={2} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={createRisk.isPending} className="bg-[#1B3A8C]">
                {createRisk.isPending ? "Registrando…" : "Registrar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ComplianceFormDialog open={showComplianceForm} onOpenChange={setShowComplianceForm} />
        <FairnessFormDialog open={showFairnessForm} onOpenChange={setShowFairnessForm} onCompleted={refetchFairness} />
    </div>
  );
}

// ─── Sub-componente: Card de conformidade por framework ───────────────────────
function ComplianceFrameworkCard({ framework, color }: { framework: "lgpd" | "eu_ai_act" | "iso_42001" | "nist_ai_rmf"; color: string }) {
  const { data: checks = [], refetch } = trpc.aiRisk.compliance.list.useQuery({ framework });
  const review = trpc.aiRisk.compliance.review.useMutation({
    onSuccess: () => { toast.success("Revisão registrada."); refetch(); },
    onError: (error) => toast.error(error.message),
  });
  const reviewed = checks.filter(c => (c.status === "passed" || c.status === "failed") && c.reviewedAt);
  const pending = checks.filter(c => !((c.status === "passed" || c.status === "failed") && c.reviewedAt) && c.status !== "not_applicable");
  const passed = reviewed.filter(c => c.status === "passed").length;
  const coverageBase = reviewed.length + pending.length;
  const coverage = coverageBase > 0 ? Math.round((reviewed.length / coverageBase) * 100) : 0;

  function requestReview(id: number, status: "passed" | "failed" | "not_applicable") {
    const prompt = status === "not_applicable" ? "Justificativa obrigatória para N/A:" : "Notas da revisão humana (opcional):";
    const reviewNotes = window.prompt(prompt);
    if (reviewNotes === null || (status === "not_applicable" && !reviewNotes.trim())) return;
    review.mutate({ id, status, reviewNotes: reviewNotes.trim() || undefined });
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-semibold" style={{ color }}>{reviewed.length}/{coverageBase} checks revisados</span>
        <span className="text-xs text-gray-500">coverage {coverage}% · {passed} passed</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${coverage}%`, background: color }} />
      </div>
      <p className="text-[11px] text-gray-500">Score = checks finais passados / checks revisados. N/A e pendentes ficam fora do score.</p>
      {checks.length === 0 && <p className="text-xs text-gray-400 mt-2">Nenhuma verificação registrada para este framework.</p>}
      {checks.slice(0, 5).map(c => {
        const isPending = c.status !== "passed" && c.status !== "failed" && c.status !== "not_applicable";
        return (
          <div key={c.id} className="flex items-center gap-2 text-xs border-t pt-2">
            {c.status === "passed" ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : c.status === "failed" ? <XCircle className="w-3.5 h-3.5 text-red-500" /> : <Clock className="w-3.5 h-3.5 text-amber-600" />}
            <span className="text-gray-600 truncate flex-1">{c.checkName}</span>
            <Badge variant="outline" className="text-[10px]">{c.status === "not_applicable" ? "N/A" : c.status === "pending_review" ? "Pendente" : c.status === "evidence_missing" ? "Sem evidência" : c.status}</Badge>
            {isPending && <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-6 px-1 text-[10px] text-green-700" onClick={() => requestReview(c.id, "passed")}>Passar</Button>
              <Button size="sm" variant="ghost" className="h-6 px-1 text-[10px] text-red-700" onClick={() => requestReview(c.id, "failed")}>Falhar</Button>
              <Button size="sm" variant="ghost" className="h-6 px-1 text-[10px]" onClick={() => requestReview(c.id, "not_applicable")}>N/A</Button>
            </div>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Sub-componente: Formulário de Compliance ──────────────────────────────────
function ComplianceFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (val: boolean) => void }) {
  const { data: models = [] } = trpc.mlops.models.list.useQuery();
  const [modelId, setModelId] = useState("");
  const [framework, setFramework] = useState<"lgpd" | "eu_ai_act" | "iso_42001" | "nist_ai_rmf">("lgpd");
  const [answers, setAnswers] = useState<Record<string, { passed: boolean; evidence: string }>>({});
  const upsert = trpc.aiRisk.compliance.upsert.useMutation();
  const automatedEvaluate = trpc.aiRisk.compliance.automatedEvaluate.useMutation();
  const utils = trpc.useUtils();
  const selectedModel = models.find(model => String(model.id) === modelId);
  const checks = COMPLIANCE_TEMPLATES[framework] || [];

  const handleSave = async () => {
    if (!selectedModel) { toast.error("Selecione um modelo"); return; }
    const missingEvidence = checks.find(check => answers[check.checkName]?.passed && !answers[check.checkName]?.evidence.trim());
    if (missingEvidence) { toast.error(`Evidência obrigatória para: ${missingEvidence.checkName}`); return; }
    let hasError = false;
    for (const check of checks) {
      const answer = answers[check.checkName] || { passed: false, evidence: "" };
      try {
        await upsert.mutateAsync({ modelId: selectedModel.id, modelName: selectedModel.name, framework, checkName: check.checkName, description: check.description, passed: answer.passed, evidence: answer.evidence || undefined });
      } catch (error) {
        console.error("Erro ao salvar compliance check", error);
        hasError = true;
      }
    }
    if (hasError) toast.error("Ocorreu um erro ao salvar algumas verificações.");
    else {
      toast.success("Checklist salvo como pendente de revisão humana.");
      utils.aiRisk.compliance.list.invalidate();
      onOpenChange(false);
      setAnswers({});
      setModelId("");
    }
  };

  const handleAutomatedEvaluate = async () => {
    if (!selectedModel) { toast.error("Selecione um modelo"); return; }
    try {
      const result = await automatedEvaluate.mutateAsync({
        modelId: selectedModel.id,
        framework,
        checks: checks.map(check => ({ checkName: check.checkName, description: check.description, evidencePresent: Boolean(answers[check.checkName]?.evidence.trim()) })),
      });
      toast.success(`${result.items.length} itens avaliados por presença de evidência; aguardando revisão.`);
      utils.aiRisk.compliance.list.invalidate();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível executar a avaliação."); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova avaliação de evidência/readiness</DialogTitle>
          <DialogDescription>O envio nunca finaliza o check: uma pessoa Admin/Data Steward deve revisar. Isso não é certificação.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex flex-col gap-4">
            <div><Label>Modelo de IA</Label><Select value={modelId} onValueChange={setModelId}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{models.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.name} ({m.version})</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Framework</Label><Select value={framework} onValueChange={value => setFramework(value as typeof framework)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(FRAMEWORK_LABELS).map(([key, value]) => <SelectItem key={key} value={key}>{value}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-4 mt-6 border-t pt-4">
            <h3 className="font-semibold text-[#1B3A8C] text-sm">Checklist: {FRAMEWORK_LABELS[framework]}</h3>
            {checks.map((check, idx) => {
              const answer = answers[check.checkName];
              return <div key={idx} className={`p-4 border rounded-lg space-y-3 transition-colors ${answer?.passed ? "bg-green-50 border-green-300" : "bg-gray-50"}`}>
                <div className="flex items-start gap-3"><Checkbox id={`check-${idx}`} checked={answer?.passed || false} onCheckedChange={checked => setAnswers(previous => ({ ...previous, [check.checkName]: { ...previous[check.checkName], passed: checked === true } }))} /><div><Label htmlFor={`check-${idx}`} className="font-medium cursor-pointer">{check.checkName}</Label><p className="text-xs text-gray-500 mt-1">{check.description}</p></div></div>
                <Input required={Boolean(answer?.passed)} placeholder={answer?.passed ? "Evidência obrigatória para marcar pass (link ou referência)" : "Referência de evidência (opcional)"} value={answer?.evidence || ""} onChange={event => setAnswers(previous => ({ ...previous, [check.checkName]: { ...previous[check.checkName], evidence: event.target.value } }))} className="text-xs h-8 bg-white" />
              </div>;
            })}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="secondary" onClick={handleAutomatedEvaluate} disabled={automatedEvaluate.isPending || !selectedModel}><Brain className="w-4 h-4 mr-1" />{automatedEvaluate.isPending ? "Avaliando…" : "Avaliar presença"}</Button>
          <Button onClick={handleSave} disabled={upsert.isPending || !selectedModel} className="bg-[#1B3A8C]">{upsert.isPending ? "Salvando…" : "Salvar pendente"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Fairness: entrada e revisão de agregados ───────────────────────────────────
type FairnessGroupForm = { code: string; sampleSize: string; positivePredictionCount: string; actualPositiveCount: string; truePositiveCount: string };
const emptyFairnessGroup = (code: string): FairnessGroupForm => ({ code, sampleSize: "20", positivePredictionCount: "0", actualPositiveCount: "", truePositiveCount: "" });

function FairnessFormDialog({ open, onOpenChange, onCompleted }: { open: boolean; onOpenChange: (value: boolean) => void; onCompleted: () => void }) {
  const { data: models = [] } = trpc.mlops.models.list.useQuery();
  const [modelId, setModelId] = useState("");
  const [datasetName, setDatasetName] = useState("");
  const [datasetVersion, setDatasetVersion] = useState("");
  const [modelVersion, setModelVersion] = useState("");
  const [protectedAttribute, setProtectedAttribute] = useState("");
  const [threshold, setThreshold] = useState("");
  const [minimumGroupSize, setMinimumGroupSize] = useState("20");
  const [methodology, setMethodology] = useState("Comparação de taxas em uma amostra agregada; resultados sujeitos a revisão humana.");
  const [groups, setGroups] = useState<FairnessGroupForm[]>([emptyFairnessGroup("g_a"), emptyFairnessGroup("g_b")]);
  const evaluate = trpc.aiRisk.fairness.evaluate.useMutation();
  const selectedModel = models.find(model => String(model.id) === modelId);
  const result = evaluate.data;

  function updateGroup(index: number, field: keyof FairnessGroupForm, value: string) { setGroups(previous => previous.map((group, i) => i === index ? { ...group, [field]: value } : group)); }
  function parseOptional(value: string) { return value.trim() === "" ? undefined : Number(value); }
  async function handleEvaluate() {
    if (!selectedModel || !datasetName || !datasetVersion || !modelVersion || !protectedAttribute || !methodology) { toast.error("Preencha modelo, versões, atributo e metodologia."); return; }
    try {
      const response = await evaluate.mutateAsync({
        modelId: selectedModel.id, modelName: selectedModel.name, modelVersion, datasetName, datasetVersion, protectedAttribute,
        decisionThreshold: parseOptional(threshold), minimumGroupSize: Number(minimumGroupSize), methodology,
        groups: groups.map(group => ({ code: group.code, sampleSize: Number(group.sampleSize), positivePredictionCount: Number(group.positivePredictionCount), actualPositiveCount: parseOptional(group.actualPositiveCount), truePositiveCount: parseOptional(group.truePositiveCount) })),
      });
      toast.success("Métricas calculadas; estado: awaiting review.");
      onCompleted();
      return response;
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível calcular fairness."); }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Avaliação agregada de fairness</DialogTitle><DialogDescription>Informe apenas contagens por grupo com códigos pseudônimos g_…; nunca dados de linha, nomes ou identificadores diretos.</DialogDescription></DialogHeader>
    <div className="grid grid-cols-2 gap-3 py-2">
      <div className="col-span-2"><Label>Modelo</Label><Select value={modelId} onValueChange={value => { setModelId(value); const model = models.find(item => String(item.id) === value); if (model && !modelVersion) setModelVersion(model.version); }}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{models.map(model => <SelectItem key={model.id} value={String(model.id)}>{model.name}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Versão do modelo</Label><Input value={modelVersion} onChange={event => setModelVersion(event.target.value)} /></div><div><Label>Atributo protegido</Label><Input value={protectedAttribute} onChange={event => setProtectedAttribute(event.target.value)} placeholder="atributo declarado" /></div>
      <div><Label>Dataset</Label><Input value={datasetName} onChange={event => setDatasetName(event.target.value)} /></div><div><Label>Versão do dataset</Label><Input value={datasetVersion} onChange={event => setDatasetVersion(event.target.value)} /></div>
      <div><Label>Limiar de decisão (opcional)</Label><Input type="number" min="0" max="1" step="0.01" value={threshold} onChange={event => setThreshold(event.target.value)} /></div><div><Label>Amostra mínima configurável</Label><Input type="number" min="1" value={minimumGroupSize} onChange={event => setMinimumGroupSize(event.target.value)} /><p className="text-[10px] text-gray-500 mt-1">Sugestão: ≥20; não é norma.</p></div>
      <div className="col-span-2"><Label>Metodologia declarada</Label><Textarea value={methodology} onChange={event => setMethodology(event.target.value)} rows={2} /></div>
    </div>
    <div className="space-y-3 border-t pt-3"><div className="flex justify-between items-center"><h3 className="font-semibold text-sm">Grupos agregados (mínimo 2)</h3><Button variant="outline" size="sm" onClick={() => setGroups(previous => [...previous, emptyFairnessGroup(`g_${String.fromCharCode(97 + previous.length)}`)])}>Adicionar grupo</Button></div>
      {groups.map((group, index) => <div key={index} className="grid grid-cols-5 gap-2 items-end"><div><Label className="text-[10px]">Código pseudônimo</Label><Input value={group.code} onChange={event => updateGroup(index, "code", event.target.value)} /></div><div><Label className="text-[10px]">Amostra</Label><Input type="number" min="1" value={group.sampleSize} onChange={event => updateGroup(index, "sampleSize", event.target.value)} /></div><div><Label className="text-[10px]">Pred. positiva</Label><Input type="number" min="0" value={group.positivePredictionCount} onChange={event => updateGroup(index, "positivePredictionCount", event.target.value)} /></div><div><Label className="text-[10px]">Actual + (opcional)</Label><Input type="number" min="0" value={group.actualPositiveCount} onChange={event => updateGroup(index, "actualPositiveCount", event.target.value)} /></div><div className="flex gap-1"><div className="flex-1"><Label className="text-[10px]">True + (opcional)</Label><Input type="number" min="0" value={group.truePositiveCount} onChange={event => updateGroup(index, "truePositiveCount", event.target.value)} /></div>{groups.length > 2 && <Button variant="ghost" size="sm" className="h-9 px-1" onClick={() => setGroups(previous => previous.filter((_, i) => i !== index))}>×</Button>}</div></div>)}
    </div>
    {result && <div className="rounded-lg bg-gray-50 border p-3 text-xs space-y-1"><strong>Métricas calculadas — awaiting review</strong><div>SPD: {Number(result.metrics.statisticalParityDifference).toFixed(4)} · DIR: {result.metrics.disparateImpactRatio === null ? "n/a" : result.metrics.disparateImpactRatio.toFixed(4)} · EOD: {result.metrics.equalOpportunityDifference === null ? "n/a (sem ground truth)" : result.metrics.equalOpportunityDifference.toFixed(4)}</div><p className="text-gray-500">Contextual; não afirma fairness universal e exige revisão humana.</p></div>}
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button><Button onClick={handleEvaluate} disabled={evaluate.isPending} className="bg-[#1B3A8C]">{evaluate.isPending ? "Calculando…" : "Calcular e enviar para revisão"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

function FairnessAssessmentCard({ assessment, onReviewed }: { assessment: any; onReviewed: () => void }) {
  const review = trpc.aiRisk.fairness.review.useMutation({ onSuccess: () => { toast.success("Revisão de fairness registrada."); onReviewed(); }, onError: error => toast.error(error.message) });
  const metrics = assessment.metrics as Record<string, number | null>;
  function decide(decision: "approved" | "rejected" | "needs_changes") { const notes = window.prompt("Justificativa da revisão:"); if (notes?.trim()) review.mutate({ id: assessment.id, decision, reviewNotes: notes.trim() }); }
  return <Card><CardContent className="p-4 space-y-2"><div className="flex items-center justify-between"><div><p className="font-medium text-sm">{assessment.modelName} · {assessment.modelVersion}</p><p className="text-xs text-gray-500">{assessment.datasetName} {assessment.datasetVersion} · atributo: {assessment.protectedAttribute}</p></div><Badge variant="outline">{assessment.status === "pending_review" ? "Aguardando revisão" : assessment.status}</Badge></div><div className="grid grid-cols-3 gap-2 text-xs"><span>SPD: {Number(metrics.statisticalParityDifference).toFixed(4)}</span><span>DIR: {metrics.disparateImpactRatio === null ? "n/a" : Number(metrics.disparateImpactRatio).toFixed(4)}</span><span>EOD: {metrics.equalOpportunityDifference === null ? "n/a" : Number(metrics.equalOpportunityDifference).toFixed(4)}</span></div>{assessment.status === "pending_review" && <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => decide("approved")}>Aprovar</Button><Button size="sm" variant="outline" onClick={() => decide("needs_changes")}>Solicitar ajustes</Button><Button size="sm" variant="outline" onClick={() => decide("rejected")}>Rejeitar</Button></div>}</CardContent></Card>;
}
