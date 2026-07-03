/**
 * BiConectores.tsx
 * Lacuna 3: Integração Power BI / SAP / Databricks — Conectores REST e Log de Sincronização
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { PlugZap, Plus, RefreshCw, CheckCircle2, XCircle, Clock, Activity } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

// ─── Constantes ───────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  powerbi:    { label: "Power BI",    color: "#F59E0B", bg: "#fef3c7" },
  sap:        { label: "SAP",         color: "#1B3A8C", bg: "#dbeafe" },
  databricks: { label: "Databricks",  color: "#dc2626", bg: "#fee2e2" },
  tableau:    { label: "Tableau",     color: "#06B6D4", bg: "#cffafe" },
  looker:     { label: "Looker",      color: "#8B5CF6", bg: "#ede9fe" },
  other:      { label: "Outro",       color: "#6b7280", bg: "#f3f4f6" },
};

const SYNC_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  success: { label: "Sucesso",    color: "#16a34a", icon: CheckCircle2 },
  error:   { label: "Erro",       color: "#dc2626", icon: XCircle },
  running: { label: "Executando", color: "#d97706", icon: RefreshCw },
  pending: { label: "Pendente",   color: "#6b7280", icon: Clock },
};

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function BiConectores() {
  const [tab, setTab] = useState("dashboard");
  const [showCreate, setShowCreate] = useState(false);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "", type: "powerbi", description: "", endpointUrl: "",
    workspaceId: "", datasetId: "", reportId: "", authMethod: "oauth2",
  });

  const { data: summary, refetch: refetchSummary } = trpc.biConnectors.connectors.summary.useQuery();
  const { data: connectors = [], refetch: refetchConnectors } = trpc.biConnectors.connectors.list.useQuery();
  const { data: recentLogs = [], refetch: refetchLogs } = trpc.biConnectors.syncLogs.recent.useQuery({ limit: 20 });

  const createConnector = trpc.biConnectors.connectors.create.useMutation({
    onSuccess: () => {
      toast.success("Conector criado com sucesso!");
      setShowCreate(false);
      setForm({ name: "", type: "powerbi", description: "", endpointUrl: "", workspaceId: "", datasetId: "", reportId: "", authMethod: "oauth2" });
      refetchSummary();
      refetchConnectors();
    },
    onError: (e) => toast.error(e.message),
  });

  const triggerSync = trpc.biConnectors.connectors.triggerSync.useMutation({
    onSuccess: (data) => {
      setSyncingId(null);
      if (data.status === "success") {
        toast.success(`Sincronização concluída: ${data.recordsSent} registros em ${data.durationMs}ms`);
      } else {
        toast.error("Sincronização falhou. Verifique os logs.");
      }
      refetchConnectors();
      refetchLogs();
      refetchSummary();
    },
    onError: (e) => { setSyncingId(null); toast.error(e.message); },
  });

  const toggleActive = trpc.biConnectors.connectors.update.useMutation({
    onSuccess: () => { refetchConnectors(); refetchSummary(); },
    onError: (e) => toast.error(e.message),
  });

  // Dados para gráficos
  const typeChartData = Object.entries(summary?.byType ?? {}).map(([k, v]) => ({
    name: TYPE_CONFIG[k]?.label ?? k, value: v as number, fill: TYPE_CONFIG[k]?.color ?? "#64748B",
  }));

  const syncSuccessRate = recentLogs.length > 0
    ? Math.round((recentLogs.filter(l => l.status === "success").length / recentLogs.length) * 100)
    : 0;

  function handleCreate() {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    createConnector.mutate({
      name: form.name,
      type: form.type as never,
      description: form.description || undefined,
      endpointUrl: form.endpointUrl || undefined,
      workspaceId: form.workspaceId || undefined,
      datasetId: form.datasetId || undefined,
      reportId: form.reportId || undefined,
      authMethod: form.authMethod,
      config: {},
    });
  }

  function handleSync(connectorId: number) {
    setSyncingId(connectorId);
    triggerSync.mutate({ connectorId });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50">
              <PlugZap className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#1B3A8C]">Integrações BI/SAP</h1>
              <p className="text-sm text-gray-500">Conectores REST para Power BI, SAP, Databricks e outros sistemas</p>
            </div>
          </div>
          <Button onClick={() => setShowCreate(true)} className="bg-[#1B3A8C] hover:bg-[#1B3A8C]/90 gap-2">
            <Plus className="w-4 h-4" /> Novo Conector
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total de Conectores", value: summary?.total ?? 0, color: "#1B3A8C" },
            { label: "Ativos", value: summary?.active ?? 0, color: "#16a34a" },
            { label: "Com Erros", value: summary?.withErrors ?? 0, color: "#dc2626" },
            { label: "Taxa de Sucesso", value: `${syncSuccessRate}%`, color: "#d97706" },
          ].map(({ label, value, color }) => (
            <Card key={label}>
              <CardContent className="p-4">
                <p className="text-2xl font-bold" style={{ color }}>{value}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="connectors">Conectores</TabsTrigger>
            <TabsTrigger value="logs">Logs de Sincronização</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gray-700">Conectores por Tipo</CardTitle>
                </CardHeader>
                <CardContent>
                  {typeChartData.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Nenhum conector configurado</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={typeChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                          {typeChartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                        </Pie>
                        <Tooltip />
                        <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gray-700">Últimas Sincronizações</CardTitle>
                  <CardDescription className="text-xs">Status dos 20 logs mais recentes</CardDescription>
                </CardHeader>
                <CardContent>
                  {recentLogs.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Nenhuma sincronização registrada</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={[
                          { name: "Sucesso", value: recentLogs.filter(l => l.status === "success").length, fill: "#16a34a" },
                          { name: "Erro", value: recentLogs.filter(l => l.status === "error").length, fill: "#dc2626" },
                          { name: "Executando", value: recentLogs.filter(l => l.status === "running").length, fill: "#d97706" },
                        ]}
                        margin={{ top: 4, right: 8, bottom: 4, left: -20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="value" name="Logs" radius={[4, 4, 0, 0]}>
                          {[{ fill: "#16a34a" }, { fill: "#dc2626" }, { fill: "#d97706" }].map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Connectors Tab */}
          <TabsContent value="connectors">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Conector</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Tipo</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Último Sync</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Total Syncs</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Ativo</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {connectors.length === 0 ? (
                        <tr><td colSpan={7} className="text-center py-12 text-gray-400">Nenhum conector configurado. Clique em "Novo Conector" para começar.</td></tr>
                      ) : connectors.map((c) => {
                        const tc = TYPE_CONFIG[c.type];
                        const sc = c.lastSyncStatus ? SYNC_STATUS_CONFIG[c.lastSyncStatus] : null;
                        const isSyncing = syncingId === c.id;
                        return (
                          <tr key={c.id} className="border-b hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-800">{c.name}</div>
                              {c.description && <div className="text-xs text-gray-400 truncate max-w-48">{c.description}</div>}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: tc?.bg, color: tc?.color }}>
                                {tc?.label ?? c.type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleString("pt-BR") : "Nunca"}
                            </td>
                            <td className="px-4 py-3">
                              {sc ? (
                                <div className="flex items-center gap-1">
                                  <sc.icon className="w-3.5 h-3.5" style={{ color: sc.color }} />
                                  <span className="text-xs font-medium" style={{ color: sc.color }}>{sc.label}</span>
                                </div>
                              ) : <span className="text-xs text-gray-400">—</span>}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600 font-mono">{c.syncCount ?? 0}</td>
                            <td className="px-4 py-3">
                              <Switch
                                checked={c.isActive ?? false}
                                onCheckedChange={(v) => toggleActive.mutate({ id: c.id, isActive: v })}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1"
                                disabled={isSyncing || !c.isActive}
                                onClick={() => handleSync(c.id)}
                              >
                                <RefreshCw className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`} />
                                {isSyncing ? "Sincronizando…" : "Sincronizar"}
                              </Button>
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

          {/* Logs Tab */}
          <TabsContent value="logs">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Conector</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Registros</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Duração</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Início</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Erro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentLogs.length === 0 ? (
                        <tr><td colSpan={6} className="text-center py-12 text-gray-400">Nenhuma sincronização registrada ainda.</td></tr>
                      ) : recentLogs.map((log) => {
                        const sc = SYNC_STATUS_CONFIG[log.status];
                        return (
                          <tr key={log.id} className="border-b hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-800 text-xs">{log.connectorName}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <sc.icon className="w-3.5 h-3.5" style={{ color: sc.color }} />
                                <span className="text-xs font-medium" style={{ color: sc.color }}>{sc.label}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs font-mono text-gray-600">{log.recordsSent ?? 0}</td>
                            <td className="px-4 py-3 text-xs font-mono text-gray-600">{log.durationMs ? `${log.durationMs}ms` : "—"}</td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {log.startedAt ? new Date(log.startedAt).toLocaleString("pt-BR") : "—"}
                            </td>
                            <td className="px-4 py-3 text-xs text-red-500 max-w-48 truncate">
                              {log.errorMessage ?? "—"}
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
        </Tabs>

        {/* Dialog: Criar Conector */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Novo Conector</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nome *</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ex: Power BI Financeiro" />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPE_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>URL do Endpoint</Label>
                  <Input value={form.endpointUrl} onChange={e => setForm(f => ({ ...f, endpointUrl: e.target.value }))} placeholder="https://api.powerbi.com/v1.0/..." />
                </div>
                <div>
                  <Label>Workspace ID</Label>
                  <Input value={form.workspaceId} onChange={e => setForm(f => ({ ...f, workspaceId: e.target.value }))} placeholder="UUID do workspace" />
                </div>
                <div>
                  <Label>Dataset ID</Label>
                  <Input value={form.datasetId} onChange={e => setForm(f => ({ ...f, datasetId: e.target.value }))} placeholder="UUID do dataset" />
                </div>
                <div>
                  <Label>Report ID</Label>
                  <Input value={form.reportId} onChange={e => setForm(f => ({ ...f, reportId: e.target.value }))} placeholder="UUID do relatório" />
                </div>
                <div>
                  <Label>Método de Autenticação</Label>
                  <Select value={form.authMethod} onValueChange={v => setForm(f => ({ ...f, authMethod: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                      <SelectItem value="api_key">API Key</SelectItem>
                      <SelectItem value="basic">Basic Auth</SelectItem>
                      <SelectItem value="service_principal">Service Principal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Descrição</Label>
                  <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descreva o propósito deste conector..." rows={2} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={createConnector.isPending} className="bg-[#1B3A8C]">
                {createConnector.isPending ? "Criando…" : "Criar Conector"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}
