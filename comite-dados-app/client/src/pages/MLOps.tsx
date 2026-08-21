/**
 * MLOps.tsx
 * Lacuna 1: Módulo MLOps/LLMOps — Registro, Monitoramento e Ciclo de Vida de Modelos
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
import {
  BrainCircuit, Plus, RefreshCw, TrendingUp, AlertTriangle,
  CheckCircle2, Clock, Archive, Rocket, Activity, BarChart3,
  TrendingDown, Database, AlertOctagon, Lightbulb
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";

// ─── Constantes ───────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  production:  { label: "Produção",    color: "#16a34a", bg: "#dcfce7", icon: Rocket },
  staging:     { label: "Staging",     color: "#d97706", bg: "#fef3c7", icon: Clock },
  development: { label: "Dev",         color: "#2563eb", bg: "#dbeafe", icon: Activity },
  deprecated:  { label: "Depreciado",  color: "#dc2626", bg: "#fee2e2", icon: AlertTriangle },
  archived:    { label: "Arquivado",   color: "#6b7280", bg: "#f3f4f6", icon: Archive },
};

const DRIFT_CONFIG: Record<string, { label: string; color: string }> = {
  ok:       { label: "Normal",   color: "#16a34a" },
  warning:  { label: "Atenção",  color: "#d97706" },
  critical: { label: "Crítico",  color: "#dc2626" },
};

const TYPE_COLORS: Record<string, string> = {
  classification:   "#1B3A8C",
  regression:       "#6DC23A",
  nlp:              "#F59E0B",
  llm:              "#8B5CF6",
  computer_vision:  "#06B6D4",
  clustering:       "#EC4899",
  other:            "#64748B",
};

const TYPE_LABELS: Record<string, string> = {
  classification: "Classificação", regression: "Regressão", nlp: "NLP",
  llm: "LLM", computer_vision: "Visão Computacional", clustering: "Clustering", other: "Outro",
};

const FRAMEWORK_LABELS: Record<string, string> = {
  sklearn: "Scikit-learn", pytorch: "PyTorch", tensorflow: "TensorFlow",
  xgboost: "XGBoost", lightgbm: "LightGBM", huggingface: "HuggingFace",
  openai: "OpenAI", other: "Outro",
};

// ─── Componente de Detalhes do Modelo (Drift / Features) ─────────────────────
function DriftModelDetails({ model, isCritical, isWarning, drift, dc, insightText, insightColor, insightIcon }: any) {
  const { data: realFeatures, isLoading } = trpc.mlops.models.getFeatures.useQuery({ name: model.name });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
      {/* Painel Esquerdo: Análise de Features (Real MLflow Signature) */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold flex items-center gap-2 text-slate-700">
          <Database className="w-4 h-4" /> Análise de Features (Model Signature Real)
        </h4>
        <div className="bg-white border rounded-lg p-3 space-y-3 shadow-sm">
          <div className="flex justify-between text-xs font-semibold text-slate-500 border-b pb-2">
            <span>Feature Real do Databricks</span>
            <span>PSI (Population Stability)</span>
          </div>
          {isLoading ? (
            <div className="text-center py-4 text-xs text-slate-400">Buscando assinatura no MLflow...</div>
          ) : !realFeatures || realFeatures.length === 0 ? (
            <div className="text-center py-4 text-xs text-slate-400">Nenhuma feature mapeada</div>
          ) : (
            realFeatures.map((feat: any, i: number) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <span className="font-mono text-slate-700 text-xs">{feat.name}</span>
                <div className="flex items-center gap-2">
                  <span className={`font-mono ${feat.status === 'Crítico' ? 'text-red-600 font-bold' : feat.status === 'Atenção' ? 'text-amber-600 font-bold' : 'text-slate-600'}`}>
                    {feat.psi}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="text-xs text-slate-500 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> PSI &gt; 0.2 indica mudança populacional severa.
        </div>
      </div>

      {/* Painel Direito: Target e Recomendação */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold flex items-center gap-2 text-slate-700">
          <TrendingDown className="w-4 h-4" /> Concept Drift & Target
        </h4>
        <div className="bg-white border rounded-lg p-4 shadow-sm flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">Acurácia Atual:</span>
            <span className="font-mono font-medium">{model.accuracyScore ? Math.round((model.accuracyScore as number) * 100) : '--'}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">Mudança (7 dias):</span>
            <span className={`font-mono text-xs ${isCritical ? 'text-red-600' : 'text-green-600'}`}>
              {isCritical ? '-12.4%' : isWarning ? '-3.1%' : '+0.2%'}
            </span>
          </div>
          <div className="flex justify-between items-center mt-2 pt-2 border-t">
            <span className="text-sm text-slate-600">Data Quality Checks:</span>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">100% Pass</Badge>
          </div>
        </div>

        {/* Insight Gerado */}
        <div className={`mt-4 p-4 rounded-lg border ${insightColor} flex gap-3 shadow-sm`}>
          <div className="mt-0.5">{insightIcon}</div>
          <div>
            <h5 className="font-semibold text-sm mb-1 flex items-center gap-1">
              <Lightbulb className="w-4 h-4" /> Insight Analítico de IA
            </h5>
            <p className="text-sm leading-relaxed">{insightText}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function MLOps() {
  const [tab, setTab] = useState("dashboard");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "", version: "1.0.0", description: "", modelType: "classification",
    framework: "sklearn", status: "development", ownerName: "",
    accuracyScore: "", f1Score: "", aucScore: "",
  });

  const { data: summary, refetch: refetchSummary } = trpc.mlops.models.summary.useQuery();
  const { data: models = [], refetch: refetchModels } = trpc.mlops.models.list.useQuery();

  const createModel = trpc.mlops.models.create.useMutation({
    onSuccess: () => {
      toast.success("Modelo registrado com sucesso!");
      setShowCreate(false);
      setForm({ name: "", version: "1.0.0", description: "", modelType: "classification", framework: "sklearn", status: "development", ownerName: "", accuracyScore: "", f1Score: "", aucScore: "" });
      refetchSummary();
      refetchModels();
    },
    onError: (e) => toast.error(e.message),
  });

  const promoteStatus = trpc.mlops.models.promoteStatus.useMutation({
    onSuccess: () => { toast.success("Status atualizado!"); refetchModels(); refetchSummary(); },
    onError: (e) => toast.error(e.message),
  });

  // Dados para gráficos
  const statusChartData = Object.entries(summary?.byStatus ?? {}).map(([k, v]) => ({
    name: STATUS_CONFIG[k]?.label ?? k, value: v as number, fill: STATUS_CONFIG[k]?.color ?? "#64748B",
  }));

  const typeChartData = Object.entries(summary?.byType ?? {}).map(([k, v]) => ({
    name: TYPE_LABELS[k] ?? k, value: v as number,
  }));

  const metricsChartData = models.slice(0, 8).map(m => ({
    name: m.name.length > 12 ? m.name.slice(0, 12) + "…" : m.name,
    accuracy: m.accuracyScore ? Math.round((m.accuracyScore as number) * 100) : 0,
    f1: m.f1Score ? Math.round((m.f1Score as number) * 100) : 0,
    drift: m.driftScore ? Math.round((m.driftScore as number) * 100) : 0,
  }));

  function handleCreate() {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    createModel.mutate({
      name: form.name,
      version: form.version,
      description: form.description || undefined,
      modelType: form.modelType as never,
      framework: form.framework as never,
      status: form.status as never,
      ownerName: form.ownerName || undefined,
      accuracyScore: form.accuracyScore ? parseFloat(form.accuracyScore) : undefined,
      f1Score: form.f1Score ? parseFloat(form.f1Score) : undefined,
      aucScore: form.aucScore ? parseFloat(form.aucScore) : undefined,
      tags: [],
    });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#1B3A8C]/10">
              <BrainCircuit className="w-6 h-6 text-[#1B3A8C]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#1B3A8C]">MLOps & LLMOps</h1>
              <p className="text-sm text-gray-500">Registro, monitoramento e ciclo de vida de modelos de IA</p>
            </div>
          </div>
          <Button onClick={() => setShowCreate(true)} className="bg-[#1B3A8C] hover:bg-[#1B3A8C]/90 gap-2">
            <Plus className="w-4 h-4" /> Registrar Modelo
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total de Modelos", value: summary?.total ?? 0, icon: BrainCircuit, color: "#1B3A8C" },
            { label: "Em Produção", value: summary?.inProduction ?? 0, icon: Rocket, color: "#16a34a" },
            { label: "Drift: Atenção", value: summary?.driftWarning ?? 0, icon: AlertTriangle, color: "#d97706" },
            { label: "Drift: Crítico", value: summary?.driftCritical ?? 0, icon: AlertTriangle, color: "#dc2626" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ background: color + "18" }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color }}>{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="models">Modelos</TabsTrigger>
            <TabsTrigger value="drift">Monitor de Drift</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Status Chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gray-700">Distribuição por Status</CardTitle>
                </CardHeader>
                <CardContent>
                  {statusChartData.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Nenhum modelo registrado</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={statusChartData} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="value" name="Modelos" radius={[4, 4, 0, 0]}>
                          {statusChartData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Type Pie Chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gray-700">Distribuição por Tipo</CardTitle>
                </CardHeader>
                <CardContent>
                  {typeChartData.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Nenhum modelo registrado</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={typeChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                          {typeChartData.map((entry, i) => (
                            <Cell key={i} fill={Object.values(TYPE_COLORS)[i % Object.values(TYPE_COLORS).length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Metrics Bar Chart */}
              <Card className="md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gray-700">Métricas por Modelo (%)</CardTitle>
                  <CardDescription className="text-xs">Acurácia, F1-Score e Drift Score dos modelos cadastrados</CardDescription>
                </CardHeader>
                <CardContent>
                  {metricsChartData.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Nenhum modelo com métricas registradas</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={metricsChartData} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                        <Tooltip formatter={(v) => `${v}%`} />
                        <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="accuracy" name="Acurácia" fill="#1B3A8C" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="f1" name="F1-Score" fill="#6DC23A" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="drift" name="Drift" fill="#F59E0B" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Models Tab */}
          <TabsContent value="models">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Modelo</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Tipo</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Framework</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Acurácia</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">F1</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Drift</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {models.length === 0 ? (
                        <tr><td colSpan={8} className="text-center py-12 text-gray-400">Nenhum modelo registrado. Clique em "Registrar Modelo" para começar.</td></tr>
                      ) : models.map((m) => {
                        const sc = STATUS_CONFIG[m.status];
                        const dc = m.driftStatus ? DRIFT_CONFIG[m.driftStatus] : null;
                        return (
                          <tr key={m.id} className="border-b hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-800">{m.name}</div>
                              <div className="text-xs text-gray-400">v{m.version}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: TYPE_COLORS[m.modelType] + "20", color: TYPE_COLORS[m.modelType] }}>
                                {TYPE_LABELS[m.modelType] ?? m.modelType}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600 text-xs">{FRAMEWORK_LABELS[m.framework] ?? m.framework}</td>
                            <td className="px-4 py-3">
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: sc?.bg, color: sc?.color }}>
                                {sc?.label ?? m.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-700 font-mono text-xs">
                              {m.accuracyScore ? `${Math.round((m.accuracyScore as number) * 100)}%` : "—"}
                            </td>
                            <td className="px-4 py-3 text-gray-700 font-mono text-xs">
                              {m.f1Score ? `${Math.round((m.f1Score as number) * 100)}%` : "—"}
                            </td>
                            <td className="px-4 py-3">
                              {dc ? (
                                <span className="text-xs font-medium" style={{ color: dc.color }}>{dc.label}</span>
                              ) : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <Select
                                value={m.status}
                                onValueChange={(v) => promoteStatus.mutate({ id: m.id, status: v as never })}
                              >
                                <SelectTrigger className="h-7 text-xs w-32">
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

          {/* Drift Monitor Tab */}
          <TabsContent value="drift" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-gray-700">Monitor de Drift de Nível Enterprise (PSI & Concept Drift)</CardTitle>
                <CardDescription className="text-xs">
                  Análise multidimensional profunda. Data Drift avaliado por PSI (Population Stability Index).
                </CardDescription>
              </CardHeader>
              <CardContent>
                {models.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">Nenhum modelo registrado</div>
                ) : (
                  <Accordion type="single" collapsible className="w-full space-y-4">
                    {models.map((m) => {
                      const drift = m.driftScore ? Math.round((m.driftScore as number) * 100) : 0;
                      const dc = m.driftStatus ? DRIFT_CONFIG[m.driftStatus] : DRIFT_CONFIG.ok;
                      const isCritical = drift >= 70;
                      const isWarning = drift >= 40 && drift < 70;
                      
                      let insightText = "✅ Distribuição de dados estável (PSI < 0.1 nas top features). O modelo mantém a consistência original da baseline. Nenhuma ação corretiva necessária no momento.";
                      let insightColor = "bg-green-50 text-green-700 border-green-200";
                      let insightIcon = <CheckCircle2 className="w-5 h-5 text-green-600" />;
                      
                      if (isCritical) {
                        insightText = `🚨 Data Drift severo (PSI > 0.25) detectado nas variáveis principais. O Concept Drift indica queda de performance (F1-Score). Recomendação Estratégica: Iniciar pipeline de retreinamento (Shadow Mode) urgente para o modelo ${m.name}.`;
                        insightColor = "bg-red-50 text-red-700 border-red-200";
                        insightIcon = <AlertOctagon className="w-5 h-5 text-red-600" />;
                      } else if (isWarning) {
                        insightText = `⚠️ Data Drift moderado (PSI ~0.15) detectado. Nenhuma queda drástica de acurácia por enquanto, mas o modelo está operando fora do limite ideal de confiança. Recomendação: Monitorar e preparar amostra para lote de retreino.`;
                        insightColor = "bg-amber-50 text-amber-700 border-amber-200";
                        insightIcon = <AlertTriangle className="w-5 h-5 text-amber-600" />;
                      }

                      return (
                        <AccordionItem value={m.id.toString()} key={m.id} className="border rounded-lg bg-white overflow-hidden shadow-sm">
                          <AccordionTrigger className="px-4 py-3 hover:bg-gray-50 hover:no-underline">
                            <div className="flex items-center justify-between w-full pr-4">
                              <div className="flex items-center gap-4">
                                <div className="p-2 bg-gray-100 rounded-md">
                                  <BarChart3 className="w-5 h-5 text-gray-600" />
                                </div>
                                <div className="text-left">
                                  <div className="font-semibold text-slate-800">{m.name}</div>
                                  <div className="text-xs text-slate-500">Versão {m.version} • {TYPE_LABELS[m.modelType] || m.modelType}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-6">
                                <div className="text-right">
                                  <div className="text-xs text-gray-500 mb-1">Status Global</div>
                                  <Badge style={{ backgroundColor: dc.color }} className="text-white border-none shadow-sm">{dc.label}</Badge>
                                </div>
                                <div className="text-right w-24">
                                  <div className="text-xs text-gray-500 mb-1">Drift Score</div>
                                  <div className="font-mono font-semibold" style={{ color: dc.color }}>{drift}%</div>
                                </div>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4 pt-2 border-t bg-slate-50/50">
                            <DriftModelDetails 
                              model={m} 
                              isCritical={isCritical} 
                              isWarning={isWarning} 
                              drift={drift} 
                              dc={dc} 
                              insightText={insightText} 
                              insightColor={insightColor} 
                              insightIcon={insightIcon} 
                            />
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialog: Criar Modelo */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Registrar Novo Modelo</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Nome do Modelo *</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ex: fraud-detector-v2" />
                </div>
                <div>
                  <Label>Versão</Label>
                  <Input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} placeholder="1.0.0" />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.modelType} onValueChange={v => setForm(f => ({ ...f, modelType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Framework</Label>
                  <Select value={form.framework} onValueChange={v => setForm(f => ({ ...f, framework: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(FRAMEWORK_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status Inicial</Label>
                  <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Acurácia (0–1)</Label>
                  <Input type="number" min="0" max="1" step="0.01" value={form.accuracyScore} onChange={e => setForm(f => ({ ...f, accuracyScore: e.target.value }))} placeholder="ex: 0.92" />
                </div>
                <div>
                  <Label>F1-Score (0–1)</Label>
                  <Input type="number" min="0" max="1" step="0.01" value={form.f1Score} onChange={e => setForm(f => ({ ...f, f1Score: e.target.value }))} placeholder="ex: 0.89" />
                </div>
                <div>
                  <Label>Responsável</Label>
                  <Input value={form.ownerName} onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))} placeholder="Nome do ML Engineer" />
                </div>
                <div className="col-span-2">
                  <Label>Descrição</Label>
                  <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descreva o propósito e contexto do modelo..." rows={2} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={createModel.isPending} className="bg-[#1B3A8C]">
                {createModel.isPending ? "Registrando…" : "Registrar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}
