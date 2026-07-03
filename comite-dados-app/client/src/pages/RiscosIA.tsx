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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AlertTriangle, Plus, ShieldCheck, Brain, Scale } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from "recharts";

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
  const [form, setForm] = useState({
    modelName: "", title: "", description: "", category: "vies",
    level: "medio", probability: "3", impact: "3",
    xaiMethod: "", xaiSummary: "", mitigationPlan: "", ownerName: "",
  });

  const { data: summary, refetch: refetchSummary } = trpc.aiRisk.assessments.summary.useQuery();
  const { data: risks = [], refetch: refetchRisks } = trpc.aiRisk.assessments.list.useQuery();

  const createRisk = trpc.aiRisk.assessments.create.useMutation({
    onSuccess: () => {
      toast.success("Risco registrado com sucesso!");
      setShowCreate(false);
      setForm({ modelName: "", title: "", description: "", category: "vies", level: "medio", probability: "3", impact: "3", xaiMethod: "", xaiSummary: "", mitigationPlan: "", ownerName: "" });
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
      ownerName: form.ownerName || undefined,
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
                <div>
                  <Label>Responsável</Label>
                  <Input value={form.ownerName} onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))} placeholder="Nome do responsável" />
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
    </div>
  );
}

// ─── Sub-componente: Card de conformidade por framework ───────────────────────
function ComplianceFrameworkCard({ framework, color }: { framework: "lgpd" | "eu_ai_act" | "iso_42001" | "nist_ai_rmf"; color: string }) {
  const { data: checks = [] } = trpc.aiRisk.compliance.list.useQuery({ framework });
  const passed = checks.filter(c => c.passed).length;
  const total = checks.length;
  const score = total > 0 ? Math.round((passed / total) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-semibold" style={{ color }}>{score}%</span>
        <span className="text-xs text-gray-400">{passed}/{total} verificações</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      {total === 0 && (
        <p className="text-xs text-gray-400 mt-2">Nenhuma verificação registrada para este framework.</p>
      )}
      {checks.slice(0, 3).map(c => (
        <div key={c.id} className="flex items-center gap-2 text-xs">
          <span className={c.passed ? "text-green-600" : "text-red-500"}>{c.passed ? "✓" : "✗"}</span>
          <span className="text-gray-600 truncate">{c.checkName}</span>
        </div>
      ))}
    </div>
  );
}
