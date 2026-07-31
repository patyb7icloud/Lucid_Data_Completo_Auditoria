/**
 * LLMOps.tsx
 * Módulo 2: LLMOps & GenAI Risk — Agentes GenAI, Herança de Permissões, Mapeamento MIP→Databricks
 * Endereça: R20 (taxonomia MIP/DLP), R22 (schemas ML DEV), R24 (agentes GenAI sem governança)
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Bot, Plus, ShieldCheck, AlertTriangle, Database, Tag,
  CheckCircle2, Lock, Unlock, Eye, EyeOff,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

// ─── Constantes ───────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  producao:      { label: "Produção",     color: "#16a34a", bg: "#dcfce7" },
  staging:       { label: "Staging",      color: "#d97706", bg: "#fef3c7" },
  desenvolvimento:{ label: "Dev",         color: "#2563eb", bg: "#dbeafe" },
  descontinuado: { label: "Descontinuado",color: "#6b7280", bg: "#f3f4f6" },
};

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  critico: { label: "Crítico", color: "#dc2626", bg: "#fee2e2" },
  alto:    { label: "Alto",    color: "#ea580c", bg: "#ffedd5" },
  medio:   { label: "Médio",   color: "#d97706", bg: "#fef3c7" },
  baixo:   { label: "Baixo",   color: "#16a34a", bg: "#dcfce7" },
};

const MIP_LEVELS = [
  { code: "CRIT-0", level: "Pública",                 tag: "public",          dlp: "Sem restrição" },
  { code: "CRIT-1", level: "Uso Interno",             tag: "internal",        dlp: "Acesso controlado" },
  { code: "CRIT-2", level: "Confidencial",            tag: "confidential",    dlp: "Criptografia em trânsito" },
  { code: "CRIT-3", level: "Restrita",                tag: "restricted",      dlp: "Criptografia + Auditoria" },
  { code: "CRIT-4", level: "Altamente Restrita",      tag: "highly_restricted",dlp: "MFA + Aprovação Data Steward" },
  { code: "CRIT-5", level: "Crítica",                 tag: "critical_pii",    dlp: "Mascaramento + RLS obrigatório" },
  { code: "CRIT-6", level: "Crítica Máxima (PII)",    tag: "pii_sensitive",   dlp: "Tokenização + CLS + DLP ativo" },
];

const CHART_COLORS = ["#1B3A8C", "#6DC23A", "#F59E0B", "#8B5CF6", "#06B6D4", "#EC4899", "#64748B"];

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function LLMOps() {
  const [openCreate, setOpenCreate] = useState(false);
  const [openMipCreate, setOpenMipCreate] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", agentType: "", llmProvider: "", llmModel: "",
    status: "desenvolvimento", riskLevel: "medio", aiOwnerName: "", domainName: "",
    dataSourcesJson: "", permissionsInherited: false, promptInjectionRisk: "nao_avaliado",
    dataLeakageRisk: "nao_avaliado", piiExposed: false, ragSourcesCount: 0,
    mipClassification: "", databricksTag: "", notes: "",
  });
  const [mipForm, setMipForm] = useState({
    mipLevel: "", mipCode: "", databricksTag: "", dlpAction: "", description: "",
  });

  const kpis    = trpc.llmops.getLlmopsKpis.useQuery();
  const agents  = trpc.llmops.listAgents.useQuery({});
  const mipMaps = trpc.llmops.listMipMappings.useQuery();

  const createAgent     = trpc.llmops.createAgent.useMutation();
  const applyPerms      = trpc.llmops.applyPermissionInheritance.useMutation();
  const createMipMap    = trpc.llmops.createMipMapping.useMutation();
  const deleteMipMap    = trpc.llmops.deleteMipMapping.useMutation();
  const utils = trpc.useUtils();

  const handleCreateAgent = async () => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    try {
      await createAgent.mutateAsync(form as any);
      toast.success("Agente GenAI cadastrado com sucesso");
      setOpenCreate(false);
      utils.llmops.invalidate();
    } catch (e: any) { toast.error(e.message ?? "Erro ao cadastrar agente"); }
  };

  const handleApplyPerms = async (agentId: number) => {
    try {
      await applyPerms.mutateAsync({ agentId });
      toast.success("Herança de permissões aplicada com sucesso");
      utils.llmops.invalidate();
    } catch (e: any) { toast.error(e.message ?? "Erro ao aplicar permissões"); }
  };

  const handleCreateMipMap = async () => {
    if (!mipForm.mipCode || !mipForm.databricksTag) { toast.error("Código MIP e Tag Databricks são obrigatórios"); return; }
    try {
      await createMipMap.mutateAsync(mipForm);
      toast.success("Mapeamento MIP criado com sucesso");
      setOpenMipCreate(false);
      utils.llmops.invalidate();
    } catch (e: any) { toast.error(e.message ?? "Erro ao criar mapeamento"); }
  };

  const kpiData = kpis.data;
  const riskChartData = Object.entries(RISK_CONFIG).map(([k, v]) => ({
    name: v.label,
    value: agents.data?.filter(a => a.riskLevel === k).length ?? 0,
    fill: v.color,
  })).filter(d => d.value > 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bot className="w-7 h-7 text-[#8B5CF6]" />
            LLMOps & GenAI Risk
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Governança de Agentes GenAI, Herança de Permissões e Mapeamento MIP → Databricks
          </p>
        </div>
        <Button onClick={() => setOpenCreate(true)} className="bg-[#8B5CF6] hover:bg-[#7c3aed]">
          <Plus className="w-4 h-4 mr-2" /> Cadastrar Agente
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Total Agentes",    value: kpiData?.total ?? 0,         icon: Bot,        color: "text-[#8B5CF6]" },
          { label: "Em Produção",      value: kpiData?.emProducao ?? 0,    icon: CheckCircle2,color: "text-green-600" },
          { label: "Risco Alto/Crítico",value: kpiData?.altaRisco ?? 0,   icon: AlertTriangle,color: "text-red-600" },
          { label: "Com PII Exposto",  value: kpiData?.comPii ?? 0,        icon: EyeOff,     color: "text-orange-500" },
          { label: "Sem Permissões",   value: kpiData?.semPermissoes ?? 0, icon: Unlock,     color: "text-red-500" },
          { label: "Risco Prompt",     value: kpiData?.promptRisco ?? 0,   icon: ShieldCheck,color: "text-orange-600" },
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

      <Tabs defaultValue="agentes">
        <TabsList>
          <TabsTrigger value="agentes">Agentes GenAI</TabsTrigger>
          <TabsTrigger value="mip">Mapeamento MIP → Databricks</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Agentes */}
        <TabsContent value="agentes" className="space-y-3">
          {agents.isLoading ? (
            <div className="text-center py-8 text-gray-400">Carregando...</div>
          ) : agents.data?.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Bot className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum agente cadastrado</p>
              <Button onClick={() => setOpenCreate(true)} variant="outline" className="mt-3">
                Cadastrar primeiro agente
              </Button>
            </div>
          ) : agents.data?.map(agent => {
            const stat = STATUS_CONFIG[agent.status] ?? STATUS_CONFIG.desenvolvimento;
            const risk = RISK_CONFIG[agent.riskLevel] ?? RISK_CONFIG.medio;
            return (
              <Card key={agent.id} className="border border-gray-200 hover:border-[#8B5CF6]/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{agent.name}</span>
                        <Badge style={{ backgroundColor: stat.bg, color: stat.color }} className="text-xs border-0">{stat.label}</Badge>
                        <Badge style={{ backgroundColor: risk.bg, color: risk.color }} className="text-xs border-0">{risk.label}</Badge>
                        {agent.piiExposed && (
                          <Badge variant="destructive" className="text-xs"><EyeOff className="w-3 h-3 mr-1" />PII Exposto</Badge>
                        )}
                        {!agent.permissionsInherited && (
                          <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                            <Unlock className="w-3 h-3 mr-1" />Sem Herança
                          </Badge>
                        )}
                        {agent.permissionsInherited && (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                            <Lock className="w-3 h-3 mr-1" />Permissões Herdadas
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1 truncate">{agent.description ?? "—"}</p>
                      <div className="flex gap-4 mt-2 text-xs text-gray-400 flex-wrap">
                        <span>Tipo: <strong className="text-gray-600">{agent.agentType ?? "—"}</strong></span>
                        <span>LLM: <strong className="text-gray-600">{agent.llmProvider ?? "—"} / {agent.llmModel ?? "—"}</strong></span>
                        <span>Owner: <strong className="text-gray-600">{agent.aiOwnerName ?? "Não designado"}</strong></span>
                        <span>MIP: <strong className="text-gray-600">{agent.mipClassification ?? "—"}</strong></span>
                        <span>Tag DB: <strong className="text-gray-600">{agent.databricksTag ?? "—"}</strong></span>
                      </div>
                    </div>
                    {!agent.permissionsInherited && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[#8B5CF6] hover:border-[#8B5CF6] shrink-0"
                        onClick={() => handleApplyPerms(agent.id)}
                        disabled={applyPerms.isPending}
                      >
                        <Lock className="w-4 h-4 mr-1" />Aplicar Permissões
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Mapeamento MIP */}
        <TabsContent value="mip" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 flex-1 mr-4">
              <Tag className="w-4 h-4 shrink-0" />
              <span>Mapeamento canônico entre classificação MIP/DLP e tags Unity Catalog Databricks (R20). Mantido pelo Data Steward.</span>
            </div>
            <Button onClick={() => setOpenMipCreate(true)} variant="outline" className="shrink-0">
              <Plus className="w-4 h-4 mr-2" />Adicionar Mapeamento
            </Button>
          </div>

          {/* Tabela de referência */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Tabela de Referência MIP → Databricks</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-gray-500 text-left">
                      <th className="pb-2 pr-4">Código MIP</th>
                      <th className="pb-2 pr-4">Nível</th>
                      <th className="pb-2 pr-4">Tag Databricks</th>
                      <th className="pb-2">Ação DLP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MIP_LEVELS.map(row => (
                      <tr key={row.code} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-2 pr-4 font-mono text-xs font-bold text-[#1B3A8C]">{row.code}</td>
                        <td className="py-2 pr-4">{row.level}</td>
                        <td className="py-2 pr-4"><code className="bg-gray-100 px-1 rounded text-xs">{row.tag}</code></td>
                        <td className="py-2 text-gray-500 text-xs">{row.dlp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Mapeamentos customizados */}
          {mipMaps.data && mipMaps.data.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Mapeamentos Customizados</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {mipMaps.data.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-3">
                      <code className="text-xs font-bold text-[#1B3A8C]">{m.mipCode}</code>
                      <span className="text-sm">{m.mipLevel}</span>
                      <span className="text-gray-400">→</span>
                      <code className="bg-gray-200 px-1 rounded text-xs">{m.databricksTag}</code>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700"
                      onClick={async () => {
                        await deleteMipMap.mutateAsync({ id: m.id });
                        utils.llmops.invalidate();
                      }}
                    >
                      Remover
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Analytics */}
        <TabsContent value="analytics">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-sm">Agentes por Nível de Risco</CardTitle></CardHeader>
              <CardContent>
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={riskChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {riskChartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Agentes por Status</CardTitle></CardHeader>
              <CardContent>
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={Object.entries(STATUS_CONFIG).map(([k, v]) => ({
                      name: v.label,
                      total: agents.data?.filter(a => a.status === k).length ?? 0,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="total" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog: Criar Agente */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Cadastrar Agente GenAI</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Agente RAG de Contratos" />
            </div>
            <div className="col-span-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div>
              <Label>Tipo de Agente</Label>
              <Input value={form.agentType} onChange={e => setForm(f => ({ ...f, agentType: e.target.value }))} placeholder="Ex: RAG, ReAct, Chatbot" />
            </div>
            <div>
              <Label>Provedor LLM</Label>
              <Input value={form.llmProvider} onChange={e => setForm(f => ({ ...f, llmProvider: e.target.value }))} placeholder="Ex: Azure OpenAI, Anthropic" />
            </div>
            <div>
              <Label>Modelo LLM</Label>
              <Input value={form.llmModel} onChange={e => setForm(f => ({ ...f, llmModel: e.target.value }))} placeholder="Ex: gpt-4o, claude-3-5-sonnet" />
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
              <Label>Nível de Risco</Label>
              <Select value={form.riskLevel} onValueChange={v => setForm(f => ({ ...f, riskLevel: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(RISK_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>AI Owner</Label>
              <Input value={form.aiOwnerName} onChange={e => setForm(f => ({ ...f, aiOwnerName: e.target.value }))} />
            </div>
            <div>
              <Label>Domínio</Label>
              <Input value={form.domainName} onChange={e => setForm(f => ({ ...f, domainName: e.target.value }))} />
            </div>
            <div>
              <Label>Classificação MIP</Label>
              <Select value={form.mipClassification} onValueChange={v => setForm(f => ({ ...f, mipClassification: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {MIP_LEVELS.map(m => <SelectItem key={m.code} value={m.code}>{m.code} — {m.level}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tag Databricks</Label>
              <Input value={form.databricksTag} onChange={e => setForm(f => ({ ...f, databricksTag: e.target.value }))} placeholder="Ex: pii_sensitive" />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.piiExposed} onCheckedChange={v => setForm(f => ({ ...f, piiExposed: v }))} />
              <Label>PII Exposto</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.permissionsInherited} onCheckedChange={v => setForm(f => ({ ...f, permissionsInherited: v }))} />
              <Label>Permissões Herdadas do Catálogo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreateAgent} disabled={createAgent.isPending} className="bg-[#8B5CF6]">
              {createAgent.isPending ? "Salvando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Criar Mapeamento MIP */}
      <Dialog open={openMipCreate} onOpenChange={setOpenMipCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Mapeamento MIP → Databricks</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Código MIP *</Label>
              <Input value={mipForm.mipCode} onChange={e => setMipForm(f => ({ ...f, mipCode: e.target.value }))} placeholder="Ex: CRIT-3" />
            </div>
            <div>
              <Label>Nível MIP</Label>
              <Input value={mipForm.mipLevel} onChange={e => setMipForm(f => ({ ...f, mipLevel: e.target.value }))} placeholder="Ex: Restrita" />
            </div>
            <div>
              <Label>Tag Databricks *</Label>
              <Input value={mipForm.databricksTag} onChange={e => setMipForm(f => ({ ...f, databricksTag: e.target.value }))} placeholder="Ex: restricted" />
            </div>
            <div>
              <Label>Ação DLP</Label>
              <Input value={mipForm.dlpAction} onChange={e => setMipForm(f => ({ ...f, dlpAction: e.target.value }))} placeholder="Ex: Criptografia + Auditoria" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenMipCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreateMipMap} disabled={createMipMap.isPending} className="bg-[#1B3A8C]">
              {createMipMap.isPending ? "Salvando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
