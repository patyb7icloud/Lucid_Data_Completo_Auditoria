/**
 * AIGovernance.tsx
 * Módulo 1: AI Governance — Inventário de Sistemas de IA
 * Endereça: R17 (sistemas sem owner), R18 (modelos sem metadados), R19 (decommissioning), R27 (inventários desconexos)
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
import {
  BrainCircuit, Plus, RefreshCw, AlertTriangle, CheckCircle2,
  Archive, ShieldAlert, Users, Server, KeyRound, Unlink,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

// ─── Constantes ───────────────────────────────────────────────────────────────
const CRITICALITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  critico:     { label: "Crítico",     color: "#dc2626", bg: "#fee2e2" },
  alto:        { label: "Alto",        color: "#ea580c", bg: "#ffedd5" },
  medio:       { label: "Médio",       color: "#d97706", bg: "#fef3c7" },
  baixo:       { label: "Baixo",       color: "#16a34a", bg: "#dcfce7" },
  nao_definido:{ label: "Não Definido",color: "#6b7280", bg: "#f3f4f6" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  ativo:        { label: "Ativo",        color: "#16a34a", icon: CheckCircle2 },
  em_revisao:   { label: "Em Revisão",   color: "#d97706", icon: RefreshCw },
  descontinuado:{ label: "Descontinuado",color: "#dc2626", icon: AlertTriangle },
  arquivado:    { label: "Arquivado",    color: "#6b7280", icon: Archive },
};

const CERT_CONFIG: Record<string, { label: string; color: string }> = {
  current:  { label: "Válido",   color: "#16a34a" },
  expired:  { label: "Expirado", color: "#dc2626" },
  sem_cert: { label: "Sem Cert", color: "#6b7280" },
};

const CHART_COLORS = ["#1B3A8C", "#6DC23A", "#F59E0B", "#8B5CF6", "#06B6D4"];

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function AIGovernance() {
  const [openCreate, setOpenCreate] = useState(false);
  const [openDecommission, setOpenDecommission] = useState<number | null>(null);
  const [decommissionNotes, setDecommissionNotes] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterCriticality, setFilterCriticality] = useState<string>("");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    name: "", description: "", systemType: "", vendor: "",
    criticality: "nao_definido", status: "ativo",
    aiOwnerName: "", itResponsible: "", domainName: "",
    entraIdAppId: "", certStatus: "sem_cert", riskLevel: "", notes: "",
  });

  const kpis = trpc.aiGovernance.getAiGovernanceKpis.useQuery();
  const systems = trpc.aiGovernance.listSystems.useQuery({
    status:      filterStatus      ? filterStatus as any      : undefined,
    criticality: filterCriticality ? filterCriticality as any : undefined,
    search:      search || undefined,
  });
  const withoutOwner = trpc.aiGovernance.listSystemsWithoutOwner.useQuery();
  const expiredCerts = trpc.aiGovernance.listExpiredCerts.useQuery();

  const createMutation    = trpc.aiGovernance.createSystem.useMutation();
  const decommissionMutation = trpc.aiGovernance.decommissionSystem.useMutation();
  const utils = trpc.useUtils();

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    try {
      await createMutation.mutateAsync(form as any);
      toast.success("Sistema de IA cadastrado com sucesso");
      setOpenCreate(false);
      setForm({ name: "", description: "", systemType: "", vendor: "",
        criticality: "nao_definido", status: "ativo", aiOwnerName: "",
        itResponsible: "", domainName: "", entraIdAppId: "",
        certStatus: "sem_cert", riskLevel: "", notes: "" });
      utils.aiGovernance.invalidate();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao cadastrar sistema");
    }
  };

  const handleDecommission = async () => {
    if (!openDecommission) return;
    try {
      await decommissionMutation.mutateAsync({ id: openDecommission, notes: decommissionNotes });
      toast.success("Sistema arquivado com sucesso");
      setOpenDecommission(null);
      setDecommissionNotes("");
      utils.aiGovernance.invalidate();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao arquivar sistema");
    }
  };

  const kpiData = kpis.data;
  const criticalityChartData = Object.entries(CRITICALITY_CONFIG).map(([key, cfg]) => ({
    name: cfg.label,
    value: systems.data?.filter(s => s.criticality === key).length ?? 0,
    fill: cfg.color,
  })).filter(d => d.value > 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BrainCircuit className="w-7 h-7 text-[#1B3A8C]" />
            AI Governance
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Inventário de Sistemas e Modelos de IA — Governança › Ciclo de Vida e Responsabilidade
          </p>
        </div>
        <Button onClick={() => setOpenCreate(true)} className="bg-[#1B3A8C] hover:bg-[#152d6e]">
          <Plus className="w-4 h-4 mr-2" /> Cadastrar Sistema
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Total",         value: kpiData?.total ?? 0,          icon: Server,      color: "text-[#1B3A8C]" },
          { label: "Ativos",        value: kpiData?.ativos ?? 0,         icon: CheckCircle2,color: "text-green-600" },
          { label: "Críticos/Altos",value: kpiData?.criticos ?? 0,       icon: AlertTriangle,color: "text-red-600" },
          { label: "Sem Owner",     value: kpiData?.semOwner ?? 0,       icon: Users,       color: "text-orange-500" },
          { label: "Descontinuados",value: kpiData?.descontinuados ?? 0, icon: Archive,     color: "text-gray-500" },
          { label: "Cert. Expirado",value: kpiData?.certExpirado ?? 0,   icon: KeyRound,    color: "text-red-600" },
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

      {/* Tabs */}
      <Tabs defaultValue="inventario">
        <TabsList>
          <TabsTrigger value="inventario">Inventário</TabsTrigger>
          <TabsTrigger value="sem-owner">
            Sem Owner
            {(withoutOwner.data?.length ?? 0) > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs">{withoutOwner.data?.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="cert-expirado">
            Certificados
            {(expiredCerts.data?.length ?? 0) > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs">{expiredCerts.data?.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Inventário */}
        <TabsContent value="inventario" className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <Input
              placeholder="Buscar sistema..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-64"
            />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCriticality} onValueChange={setFilterCriticality}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Criticidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas</SelectItem>
                {Object.entries(CRITICALITY_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            {systems.isLoading ? (
              <div className="text-center py-8 text-gray-400">Carregando...</div>
            ) : systems.data?.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Server className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum sistema cadastrado</p>
                <Button onClick={() => setOpenCreate(true)} variant="outline" className="mt-3">
                  Cadastrar primeiro sistema
                </Button>
              </div>
            ) : systems.data?.map(sys => {
              const crit = CRITICALITY_CONFIG[sys.criticality] ?? CRITICALITY_CONFIG.nao_definido;
              const stat = STATUS_CONFIG[sys.status] ?? STATUS_CONFIG.ativo;
              const StatusIcon = stat.icon;
              return (
                <Card key={sys.id} className="border border-gray-200 hover:border-[#1B3A8C]/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">{sys.name}</span>
                          <Badge style={{ backgroundColor: crit.bg, color: crit.color }} className="text-xs border-0">
                            {crit.label}
                          </Badge>
                          <Badge style={{ color: stat.color }} variant="outline" className="text-xs">
                            <StatusIcon className="w-3 h-3 mr-1" />{stat.label}
                          </Badge>
                          {sys.certStatus === "expired" && (
                            <Badge variant="destructive" className="text-xs">
                              <KeyRound className="w-3 h-3 mr-1" />Cert. Expirado
                            </Badge>
                          )}
                          {!sys.aiOwnerName && (
                            <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                              <Unlink className="w-3 h-3 mr-1" />Sem Owner
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1 truncate">{sys.description ?? "—"}</p>
                        <div className="flex gap-4 mt-2 text-xs text-gray-400 flex-wrap">
                          <span>Tipo: <strong className="text-gray-600">{sys.systemType ?? "—"}</strong></span>
                          <span>Vendor: <strong className="text-gray-600">{sys.vendor ?? "—"}</strong></span>
                          <span>AI Owner: <strong className="text-gray-600">{sys.aiOwnerName ?? "Não designado"}</strong></span>
                          <span>Domínio: <strong className="text-gray-600">{sys.domainName ?? "—"}</strong></span>
                        </div>
                      </div>
                      {sys.status !== "arquivado" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-gray-500 hover:text-red-600 hover:border-red-300 shrink-0"
                          onClick={() => setOpenDecommission(sys.id)}
                        >
                          <Archive className="w-4 h-4 mr-1" />Arquivar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Sem Owner */}
        <TabsContent value="sem-owner" className="space-y-3">
          <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Sistemas sem AI Owner designado representam risco de governança (R17). Atribua responsáveis imediatamente.</span>
          </div>
          {withoutOwner.data?.length === 0 ? (
            <div className="text-center py-8 text-green-600">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2" />
              <p>Todos os sistemas possuem AI Owner designado.</p>
            </div>
          ) : withoutOwner.data?.map(sys => (
            <Card key={sys.id} className="border border-orange-200">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{sys.name}</p>
                  <p className="text-xs text-gray-500">{sys.systemType ?? "—"} · {sys.vendor ?? "—"}</p>
                </div>
                <Badge variant="outline" className="text-orange-600 border-orange-300">Sem Owner</Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Certificados */}
        <TabsContent value="cert-expirado" className="space-y-3">
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Certificados Entra ID expirados representam risco de segurança (R16). Renove imediatamente.</span>
          </div>
          {expiredCerts.data?.length === 0 ? (
            <div className="text-center py-8 text-green-600">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2" />
              <p>Nenhum certificado expirado encontrado.</p>
            </div>
          ) : expiredCerts.data?.map(sys => (
            <Card key={sys.id} className="border border-red-200">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{sys.name}</p>
                  <p className="text-xs text-gray-500">
                    App ID: {sys.entraIdAppId ?? "—"} · Expirou em:{" "}
                    {sys.certExpiresAt ? new Date(sys.certExpiresAt).toLocaleDateString("pt-BR") : "—"}
                  </p>
                </div>
                <Badge variant="destructive">Expirado</Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Analytics */}
        <TabsContent value="analytics">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-sm">Distribuição por Criticidade</CardTitle></CardHeader>
              <CardContent>
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={criticalityChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {criticalityChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Sistemas por Status</CardTitle></CardHeader>
              <CardContent>
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={Object.entries(STATUS_CONFIG).map(([k, v]) => ({
                      name: v.label,
                      total: systems.data?.filter(s => s.status === k).length ?? 0,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="total" fill="#1B3A8C" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog: Criar Sistema */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cadastrar Sistema de IA</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Agente de Análise de Crédito" />
            </div>
            <div className="col-span-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div>
              <Label>Tipo de Sistema</Label>
              <Input value={form.systemType} onChange={e => setForm(f => ({ ...f, systemType: e.target.value }))} placeholder="Ex: Agente GenAI, Modelo Preditivo" />
            </div>
            <div>
              <Label>Vendor / Fornecedor</Label>
              <Input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} placeholder="Ex: Azure, AWS, Interno" />
            </div>
            <div>
              <Label>Criticidade</Label>
              <Select value={form.criticality} onValueChange={v => setForm(f => ({ ...f, criticality: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CRITICALITY_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>AI Owner</Label>
              <Input value={form.aiOwnerName} onChange={e => setForm(f => ({ ...f, aiOwnerName: e.target.value }))} placeholder="Nome do responsável" />
            </div>
            <div>
              <Label>Responsável TI</Label>
              <Input value={form.itResponsible} onChange={e => setForm(f => ({ ...f, itResponsible: e.target.value }))} placeholder="Nome do responsável TI" />
            </div>
            <div>
              <Label>Domínio</Label>
              <Input value={form.domainName} onChange={e => setForm(f => ({ ...f, domainName: e.target.value }))} placeholder="Ex: Financeiro, RH" />
            </div>
            <div>
              <Label>App ID Entra ID</Label>
              <Input value={form.entraIdAppId} onChange={e => setForm(f => ({ ...f, entraIdAppId: e.target.value }))} placeholder="UUID do Azure AD" />
            </div>
            <div>
              <Label>Status do Certificado</Label>
              <Select value={form.certStatus} onValueChange={v => setForm(f => ({ ...f, certStatus: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CERT_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="bg-[#1B3A8C]">
              {createMutation.isPending ? "Salvando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Decommissioning */}
      <Dialog open={!!openDecommission} onOpenChange={() => setOpenDecommission(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Arquivar Sistema (Decommissioning)</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <Archive className="w-4 h-4" />
              <span>Esta ação arquiva o sistema e encerra seu ciclo de vida ativo. Informe o motivo.</span>
            </div>
            <div>
              <Label>Motivo do Arquivamento</Label>
              <Textarea
                value={decommissionNotes}
                onChange={e => setDecommissionNotes(e.target.value)}
                rows={3}
                placeholder="Ex: Substituído por nova versão, contrato encerrado..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDecommission(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={handleDecommission}
              disabled={decommissionMutation.isPending}
            >
              {decommissionMutation.isPending ? "Arquivando..." : "Confirmar Arquivamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
