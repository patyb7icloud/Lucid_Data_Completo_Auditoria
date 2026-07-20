import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { 
  Database, 
  Search, 
  MoreHorizontal,
  ShieldCheck,
  Activity,
  GitBranch,
  Clock,
  Users,
  Star,
  Zap,
  TrendingUp,
  Globe,
  Filter,
  BarChart3,
  ArrowRight,
  MousePointer2,
  Share2,
  FileText,
  LayoutDashboard,
  Building2,
  AlertCircle,
  PieChart as PieChartIcon,
  Monitor,
  ExternalLink,
  ChevronRight,
  Lock,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  UserCheck,
  FileKey,
  Edit2,
  Save,
  Loader2,
  X,
  Bot,
  Play,
  CheckCircle2,
  XCircle,
  Sparkles,
  ChevronDown,
  FileBarChart2,
  ScrollText,
  ShieldAlert as ShieldAlertIcon,
  Tag,
  BookMarked,
  ClipboardList,
  Copy,
  ExternalLink as ExternalLinkIcon
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  Cell
} from "recharts";

export default function DataCatalog() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [regionFilter, setRegionFilter] = useState("Todas");
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [editAsset, setEditAsset] = useState<any>(null);
  const [accessAsset, setAccessAsset] = useState<any>(null);
  const [accessStep, setAccessStep] = useState<1 | 2 | 3>(1);

  type CLA = "sim" | "nao" | "na" | "";
  type CLItem = { resp: CLA; evidencia: string };
  type CL = Record<string, CLItem>;

  const SEC1 = [
    { id: "1.1", crit: "A finalidade do acesso está claramente documentada na Matriz de Acesso?", owner: "Privacy Champion" },
    { id: "1.2", crit: "A base legal para o tratamento de dados pessoais foi validada pelo Jurídico?", owner: "Departamento Jurídico" },
    { id: "1.3", crit: "O acesso está alinhado com o princípio do menor privilégio (concede apenas o necessário)?", owner: "Privacy Champion / Time Técnico" },
    { id: "1.4", crit: "O ativo de dado está registrado no RoPA (Registro de Operações de Tratamento)?", owner: "Privacy Champion" },
    { id: "1.5", crit: "Foi realizado RIPD/DPIA para este tratamento? (Obrigatório para alto risco)", owner: "Time LGPD / Jurídico" },
    { id: "1.6", crit: "Se Shadow IT, o processo de homologação (PO-18774) foi seguido?", owner: "Governança de TI" },
  ];
  const SEC2 = [
    { id: "2.1", crit: "Autenticação usa identidade VC (ex: Azure AD)?", owner: "Segurança da Informação" },
    { id: "2.2", crit: "Dados criptografados em trânsito e repouso?", owner: "Segurança da Informação" },
    { id: "2.3", crit: "Acesso ao dado registrado em logs (quem/o quê/quando)?", owner: "Time Técnico" },
    { id: "2.4", crit: "Existe plano de resposta a incidentes de segurança?", owner: "Segurança da Informação" },
    { id: "2.5", crit: "Acesso de redes externas/dispositivos não gerenciados é controlado?", owner: "Segurança da Informação" },
    { id: "2.6", crit: "Política de retenção de dados aplicada a este ativo?", owner: "Data Owner / Time Técnico" },
  ];
  const SEC3 = [
    { id: "3.1", crit: "O fornecedor (terceiro) passou por avaliação de segurança (due diligence)?", owner: "Segurança da Informação" },
    { id: "3.2", crit: "O contrato inclui cláusulas de proteção de dados e conformidade com a LGPD?", owner: "Departamento Jurídico" },
    { id: "3.3", crit: "O compartilhamento de dados com o terceiro está mapeado e justificado?", owner: "Privacy Champion" },
  ];

  const emptyCL: CL = Object.fromEntries(
    [...SEC1, ...SEC2, ...SEC3].map(i => [i.id, { resp: "" as CLA, evidencia: "" }])
  );

  const [accessForm, setAccessForm] = useState({
    nivelAcesso: "",
    papelGrupo: "",
    baseLegal: "",
    finalidade: "",
    prazoNecessidade: "",
    envolveTerceiros: false,
    checklist: { ...emptyCL },
  });

  const step1Valid = !!(accessForm.nivelAcesso && accessForm.papelGrupo.trim().length > 2 && accessForm.baseLegal && accessForm.finalidade.trim().length > 10);
  const sec1Done = SEC1.every(i => accessForm.checklist[i.id]?.resp !== "");
  const sec2Done = SEC2.every(i => accessForm.checklist[i.id]?.resp !== "");
  const sec3Done = !accessForm.envolveTerceiros || SEC3.every(i => accessForm.checklist[i.id]?.resp !== "");
  const step2Valid = sec1Done && sec2Done && sec3Done;

  function setCLResp(id: string, resp: CLA) {
    setAccessForm(f => ({ ...f, checklist: { ...f.checklist, [id]: { ...f.checklist[id], resp } } }));
  }
  function setCLEvid(id: string, evidencia: string) {
    setAccessForm(f => ({ ...f, checklist: { ...f.checklist, [id]: { ...f.checklist[id], evidencia } } }));
  }

  function resetAccessModal() {
    setAccessAsset(null);
    setAccessStep(1);
    setAccessForm({ nivelAcesso: "", papelGrupo: "", baseLegal: "", finalidade: "", prazoNecessidade: "", envolveTerceiros: false, checklist: { ...emptyCL } });
  }

  const createAccessRequest = trpc.accessRequests.create.useMutation({
    onSuccess: () => {
      toast.success("Solicitação enviada com sucesso!", { description: "A solicitação foi registrada. O Data Owner será notificado para aprovação." });
      resetAccessModal();
    },
    onError: () => toast.error("Erro ao registrar solicitação. Tente novamente."),
  });

  function handleRequestAccess() {
    if (!accessAsset) return;
    createAccessRequest.mutate({
      ticketNumber: `SOL-${Date.now().toString().slice(-6)}`,
      assetId: accessAsset.id,
      nivelAcesso: accessForm.nivelAcesso as "leitura" | "leitura_escrita",
      papelGrupo: accessForm.papelGrupo,
      baseLegal: accessForm.baseLegal as "legitimo_interesse" | "execucao_contrato",
      finalidade: accessForm.finalidade,
      prazoNecessidade: accessForm.prazoNecessidade || undefined,
      checklistJson: JSON.stringify(accessForm.checklist),
      envolveTerceiros: accessForm.envolveTerceiros,
      ownerId: accessAsset.ownerId ?? undefined,
      stewardId: accessAsset.stewardId ?? undefined,
      flowType: accessForm.envolveTerceiros ? "terceiros" : "acesso_dados",
      priority: accessForm.nivelAcesso === "leitura_escrita" ? "alta" : "media",
    });
  }

  const { data: assets, isLoading, refetch } = trpc.governance.listAssets.useQuery({});
  const { data: participantsList } = trpc.participants.list.useQuery({});

  const updateAsset = trpc.governance.updateAsset.useMutation({
    onSuccess: () => {
      toast.success("Ativo atualizado!");
      setEditAsset(null);
      refetch();
    },
    onError: (err) => toast.error(`Erro ao atualizar: ${err.message}`),
  });

  const filteredAssets = useMemo(() => {
    const list = Array.isArray(assets) ? assets : [];
    return list.filter(asset => {
      const matchesSearch = (asset.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (asset.sourceSystem || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRegion = regionFilter === "Todas" || asset.region === regionFilter;
      return matchesSearch && matchesRegion;
    });
  }, [assets, searchTerm, regionFilter]);

  const stats = useMemo(() => {
    const list = Array.isArray(assets) ? assets : [];
    if (list.length === 0) return { total: 0, quality: "0", regions: 0 };
    const avgQuality = list.reduce((acc, a) => acc + (Number(a.qualityScore) || 0), 0) / list.length;
    const uniqueRegions = new Set(list.map(a => a.region)).size;
    return {
      total: list.length,
      quality: avgQuality.toFixed(1),
      regions: uniqueRegions
    };
  }, [assets]);

  // ── Drill-down dos cards de KPI ─────────────────────────────────────────────
  type CatalogDrillType = "total" | "quality" | "regions" | "governance" | null;
  const [catalogDrill, setCatalogDrill] = useState<CatalogDrillType>(null);

  // ── Pipeline de Agentes de Governança ────────────────────────────────────────
  type AgentName = "inspection" | "classification" | "documentation" | "audit";
  type AgentStatus = "pending" | "running" | "completed" | "failed";
  type AgentResult = { agent: AgentName; status: AgentStatus; output: string; durationMs: number; error?: string };
  type FinalState = {
    runId: string;
    assetId?: number;
    assetName?: string;
    sourceSystem?: string;
    fullyQualifiedName?: string;
    columns: Array<{ name: string; type: string; description?: string }>;
    piiScanResult?: { piiCount: number; columns: Array<{ name: string; piiType: string; confidence: number }> };
    classificationResult?: { sensitivity: string; tags: string[]; governancePolicies: string[]; reasoning: string };
    documentationResult?: { reportMarkdown: string; glossaryTerms: Array<{ term: string; definition: string; category: string }> };
    auditResult?: { riskScore: number; recommendations: string[]; accessAlerts: string[]; complianceStatus: string };
    startedAt: string;
    completedAt?: string;
    durationMs?: number;
  };
  type AgentPanelState = {
    open: boolean;
    assetId: number | null;
    assetName: string;
    mode: "single" | "global";
    running: boolean;
    done: boolean;
    agents: Array<{ name: AgentName; label: string; icon: string; status: AgentStatus; output?: string; durationMs?: number; error?: string }>;
    summary?: string;
    runId?: string;
    finalState?: FinalState;
    reportOpen: boolean;
  };

  const AGENT_DEFS: Array<{ name: AgentName; label: string; icon: string; description: string }> = [
    { name: "inspection",      label: "Inspeção",      icon: "🔍", description: "Leitura e catalogamento de metadados" },
    { name: "classification",  label: "Classificação",  icon: "🏷️", description: "Aplica tags de governança e PII" },
    { name: "documentation",   label: "Documentação",   icon: "📝", description: "Gera relatório e glossário automático" },
    { name: "audit",           label: "Auditoria",       icon: "🛡️", description: "Avalia risco e conformidade" },
  ];

  const initPanelAgents = () => AGENT_DEFS.map(a => ({ name: a.name, label: a.label, icon: a.icon, status: "pending" as AgentStatus }));

  const [agentPanel, setAgentPanel] = useState<AgentPanelState>({
    open: false, assetId: null, assetName: "", mode: "single",
    running: false, done: false, agents: initPanelAgents(), reportOpen: false,
  });

  const runAgentsMutation = trpc.governance.runGovernanceAgents.useMutation({
    onSuccess: (result: any) => {
      const agentResults: AgentResult[] = result.agentResults ?? [];
      setAgentPanel(p => ({
        ...p,
        running: false,
        done: true,
        runId: result.runId,
        summary: result.summary,
        finalState: result.finalState ? { ...result.finalState, durationMs: result.durationMs } : undefined,
        agents: p.agents.map(a => {
          const r = agentResults.find(r => r.agent === a.name);
          return r
            ? { ...a, status: r.status, output: r.output, durationMs: r.durationMs, error: r.error }
            : { ...a, status: "pending" as AgentStatus };
        }),
      }));
      toast.success("Pipeline de agentes concluído!", { description: result.summary });
      refetch();
    },
    onError: (err: any) => {
      setAgentPanel(p => ({ ...p, running: false }));
      toast.error("Erro ao executar agentes: " + err.message);
    },
  });

  function openAgentPanel(asset: any) {
    setAgentPanel({ open: true, assetId: asset.id, assetName: asset.name, mode: "single", running: false, done: false, agents: initPanelAgents(), reportOpen: false });
  }

  function startAgents() {
    if (!agentPanel.assetId) return;
    setAgentPanel(p => ({
      ...p,
      running: true,
      done: false,
      agents: p.agents.map((a, i) => ({ ...a, status: i === 0 ? "running" : "pending" })),
    }));
    runAgentsMutation.mutate({ assetId: agentPanel.assetId });
  }
  const [drillSearch, setDrillSearch] = useState("");

  const drillAssets = useMemo(() => {
    const list = Array.isArray(assets) ? assets : [];
    let result: typeof list;
    switch (catalogDrill) {
      case "total":      result = list; break;
      case "quality":    result = [...list].sort((a, b) => (Number(b.qualityScore) || 0) - (Number(a.qualityScore) || 0)); break;
      case "regions":    result = [...list].sort((a, b) => (a.region || "").localeCompare(b.region || "")); break;
      case "governance": result = list.filter(a => a.sensitivity === "restrito" || a.sensitivity === "confidencial" || a.ownerId); break;
      default:           result = list;
    }
    if (!drillSearch.trim()) return result;
    const q = drillSearch.toLowerCase();
    return result.filter(a =>
      (a.name || "").toLowerCase().includes(q) ||
      (a.region || "").toLowerCase().includes(q) ||
      (a.sourceSystem || "").toLowerCase().includes(q)
    );
  }, [assets, catalogDrill, drillSearch]);

  const drillMeta: Record<Exclude<CatalogDrillType, null>, { title: string; description: string }> = {
    total:      { title: "Todos os Ativos de Dados",    description: "Lista completa de ativos cadastrados no catálogo global." },
    quality:    { title: "Saúde dos Ativos",            description: "Ativos ordenados por score de qualidade (maior para menor)." },
    regions:    { title: "Ativos por Região",           description: "Ativos agrupados e ordenados por região geográfica." },
    governance: { title: "Ativos com Governança Ativa",  description: "Ativos com classificação sensível ou com Data Owner atribuído." },
  };

  // Dados de consumo traduzidos
  const consumptionMetrics = {
    dashboards: [
      { name: "PBI_FINANCEIRO_GLOBAL", area: "Financeiro", impact: "Crítico", type: "Power BI" },
      { name: "TABLEAU_LOGISTICA_NA", area: "Logística", impact: "Alto", type: "Tableau" },
      { name: "DASH_VENDA_DIARIA_BR", area: "Vendas", impact: "Crítico", type: "Power BI" },
      { name: "COCKPIT_DIRETORIA_VC", area: "Executivo", impact: "Crítico", type: "Power BI" },
    ],
    areas: [
      { name: "Logística", weight: 45, color: "#1B3A8C" },
      { name: "Vendas", weight: 35, color: "#0ea5e9" },
      { name: "Financeiro", weight: 20, color: "#f59e0b" },
    ],
    history: [
      { name: 'Jan', acessos: 45 },
      { name: 'Fev', acessos: 52 },
      { name: 'Mar', acessos: 48 },
      { name: 'Abr', acessos: 70 },
      { name: 'Mai', acessos: 85 },
    ]
  };

  if (isLoading) return <div className="p-10 text-center font-bold text-blue-900">Sincronizando Catálogo Global...</div>;

  const sortedParticipants = [...(participantsList || [])]
    .filter((participant) => participant.status !== "inativo")
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const ownerOptions = sortedParticipants.filter((participant) => participant.role === "data_owner");
  const stewardOptions = sortedParticipants.filter((participant) => participant.role === "data_steward");

  function openLineage(asset: { id: number; name: string }) {
    const params = new URLSearchParams({ assetId: String(asset.id), assetName: asset.name });
    setLocation(`/linhagem?${params.toString()}`);
  }

  function openCreateContract(asset: { id: number }) {
    const params = new URLSearchParams({ assetId: String(asset.id), create: "1" });
    setLocation(`/contratos?${params.toString()}`);
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Diálogo de Edição de Ativo */}
      <Dialog open={!!editAsset} onOpenChange={() => setEditAsset(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Ativo: {editAsset?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Críticidade</Label>
              <Select 
                value={editAsset?.criticality || "media"} 
                onValueChange={(v) => setEditAsset({...editAsset, criticality: v})}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="critica">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Status</Label>
              <Select 
                value={editAsset?.status || "ativo"} 
                onValueChange={(v) => setEditAsset({...editAsset, status: v})}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="deprecated">Deprecated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Owner</Label>
              <Select 
                value={editAsset?.ownerId?.toString() || "null"} 
                onValueChange={(v) => setEditAsset({...editAsset, ownerId: v === "null" ? null : parseInt(v)})}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Selecione um Owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Nenhum</SelectItem>
                  {ownerOptions.map(participant => (
                    <SelectItem key={participant.id} value={participant.id.toString()}>{participant.name} ({participant.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Steward</Label>
              <Select 
                value={editAsset?.stewardId?.toString() || "null"} 
                onValueChange={(v) => setEditAsset({...editAsset, stewardId: v === "null" ? null : parseInt(v)})}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Selecione um Steward" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Nenhum</SelectItem>
                  {stewardOptions.map(participant => (
                    <SelectItem key={participant.id} value={participant.id.toString()}>{participant.name} ({participant.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Tipo de Valor (Score)</Label>
              <Select 
                value={editAsset?.scoreType || (editAsset?.rawBusinessValueScore > 0 ? "manual" : "auto")} 
                onValueChange={(v) => {
                  if (v === "auto") {
                    setEditAsset({
                      ...editAsset, 
                      scoreType: "auto",
                      businessValueScore: 0
                    });
                  } else {
                    setEditAsset({
                      ...editAsset, 
                      scoreType: "manual",
                      businessValueScore: editAsset?.rawBusinessValueScore > 0 ? editAsset.rawBusinessValueScore : (editAsset?.businessValueScore || 50)
                    });
                  }
                }}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automático (via Linhagem)</SelectItem>
                  <SelectItem value="manual">Manual (Sobrescrever)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(editAsset?.scoreType === "manual" || (!editAsset?.scoreType && editAsset?.rawBusinessValueScore > 0)) ? (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Score de Valor</Label>
                <div className="col-span-3 flex items-center gap-4">
                  <Input 
                    type="number"
                    min={1}
                    max={100}
                    value={editAsset?.businessValueScore || 50}
                    onChange={(e) => {
                      const val = Math.min(100, Math.max(1, parseInt(e.target.value) || 0));
                      setEditAsset({...editAsset, businessValueScore: val});
                    }}
                    className="w-24"
                  />
                  <span className="text-xs text-muted-foreground">Valor fixo de negócio (1 a 100).</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right text-muted-foreground">Score Estimado</Label>
                <div className="col-span-3 flex items-center gap-2">
                  <Badge variant="secondary" className="bg-blue-50 text-blue-700 font-bold border-blue-100">
                    {editAsset?.businessValueScore}%
                  </Badge>
                  <span className="text-xs text-muted-foreground">(Calculado dinamicamente via linhagem)</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right col-span-4 text-xs text-muted-foreground font-medium pt-1">Nome Completo no Sistema Origem</Label>
              <Input
                className="col-span-4 font-mono text-xs"
                placeholder="catalog.schema.table_name  (ex: lucid_data.silver.CLIENTES)"
                value={editAsset?.fullyQualifiedName || ""}
                onChange={(e) => setEditAsset({...editAsset, fullyQualifiedName: e.target.value})}
              />
              <p className="col-span-4 text-[11px] text-muted-foreground -mt-2">Usado para grant automático no Databricks Unity Catalog após aprovação de acesso.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAsset(null)}>Cancelar</Button>
            <Button 
              onClick={() => updateAsset.mutate({
                id: editAsset.id,
                criticality: editAsset.criticality,
                status: editAsset.status,
                ownerId: editAsset.ownerId,
                stewardId: editAsset.stewardId,
                fullyQualifiedName: editAsset.fullyQualifiedName || undefined,
                businessValueScore: editAsset.businessValueScore,
              })}
              disabled={updateAsset.isPending}
              className="bg-[#1B3A8C]"
            >
              {updateAsset.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-900">
            <Globe className="h-6 w-6 text-blue-600" /> Catálogo Global de Ativos
          </h1>
          <p className="text-sm text-gray-500 font-medium italic">Visibilidade unificada das operações Brasil, NA e Europa.</p>
        </div>
        <div className="flex gap-2">
          {["Todas", "Brasil", "América do Norte", "Europa"].map(reg => (
            <Button 
              key={reg}
              variant={regionFilter === reg ? "default" : "outline"}
              size="sm"
              onClick={() => setRegionFilter(reg)}
              className={regionFilter === reg ? "bg-[#1B3A8C]" : ""}
            >
              {reg}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Ativos Globais" value={stats.total} icon={Database} onClick={() => { setDrillSearch(""); setCatalogDrill("total"); }} />
        <StatCard label="Saúde Média" value={`${stats.quality}%`} icon={ShieldCheck} color="text-green-600" onClick={() => { setDrillSearch(""); setCatalogDrill("quality"); }} />
        <StatCard label="Regiões Ativas" value={stats.regions} icon={Globe} color="text-blue-600" onClick={() => { setDrillSearch(""); setCatalogDrill("regions"); }} />
        <StatCard label="Governança" value="Nível 4" icon={Star} color="text-amber-500" onClick={() => { setDrillSearch(""); setCatalogDrill("governance"); }} />
      </div>

      {/* Modal de drill-down dos cards de KPI */}
      {catalogDrill && (
        <Dialog open onOpenChange={() => setCatalogDrill(null)}>
          <DialogContent className="max-w-2xl max-h-[78vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <Database size={16} className="text-[#1B3A8C]" />
                {drillMeta[catalogDrill].title}
                <span className="ml-1 text-xs font-semibold text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">
                  {drillAssets.length}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                {drillMeta[catalogDrill].description}
              </DialogDescription>
            </DialogHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nome, região ou sistema..."
                className="w-full pl-8 pr-3 h-8 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={drillSearch}
                onChange={(e) => setDrillSearch(e.target.value)}
              />
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-gray-100 rounded-lg border border-gray-100">
              {drillAssets.length === 0 ? (
                <div className="p-10 text-center text-sm text-gray-400">Nenhum ativo encontrado.</div>
              ) : (
                drillAssets.map((asset: any) => {
                  const score = Number(asset.qualityScore) || 0;
                  const scoreColor = score >= 80 ? "text-green-600" : score >= 60 ? "text-amber-600" : "text-red-500";
                  return (
                    <div key={asset.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <Database size={14} className="text-[#1B3A8C]" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-gray-900 truncate">{asset.name}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {asset.region && <span className="mr-2">{asset.region}</span>}
                            {asset.sourceSystem && <span className="text-gray-300">· {asset.sourceSystem}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        {asset.sensitivity && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 uppercase">
                            {asset.sensitivity}
                          </span>
                        )}
                        <span className={`text-xs font-black ${scoreColor}`}>{score.toFixed(0)}%</span>
                        <button
                          className="text-gray-300 hover:text-[#1B3A8C] transition-colors"
                          onClick={() => { setCatalogDrill(null); setSelectedAsset({ ...asset, consumerCount: 0 }); }}
                          title="Ver detalhes"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="flex justify-end pt-1">
              <Button variant="outline" size="sm" onClick={() => setCatalogDrill(null)}>
                <X size={13} className="mr-1" /> Fechar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Card className="border-none shadow-md bg-white overflow-hidden">
        <CardHeader className="bg-gray-50/50 border-b p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Buscar ativos em qualquer região..." 
              className="pl-9 h-11 border-gray-200"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/30">
              <TableHead className="font-bold text-[10px] uppercase">Região / Ativo</TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Sistema Origem</TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Saúde do Dado</TableHead>
              <TableHead className="font-bold text-[10px] uppercase text-center">Consumidores</TableHead>
              <TableHead className="font-bold text-[10px] uppercase text-center">Valor (Score)</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAssets.map((asset) => {
              const consumerCount = Math.floor((asset.businessValueScore || 0) * 0.8) + 5;
              
              return (
                <TableRow 
                  key={asset.id} 
                  className="hover:bg-blue-50/10 transition-colors group"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center justify-center w-10 h-10 bg-gray-50 rounded-xl border border-gray-100 text-[10px] font-black text-blue-800">
                        {asset.region === 'Brasil' ? 'BR' : asset.region === 'Europa' ? 'EU' : 'NA'}
                      </div>
                      <div>
                        <p className="font-black text-sm text-gray-900">{asset.name}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">{asset.region}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-none font-bold">
                      {asset.sourceSystem}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 group/score relative">
                      <div className="flex items-center gap-2">
                        <Progress value={Number(asset.qualityScore) || 0} className={`h-1.5 w-16 ${
                          (asset.qualityScore || 0) < 50 ? 'bg-red-100 [&>div]:bg-red-500' : 
                          (asset.qualityScore || 0) < 80 ? 'bg-amber-100 [&>div]:bg-amber-500' : 
                          'bg-green-100 [&>div]:bg-green-500'
                        }`} />
                        <span className={`text-[10px] font-black ${
                          (asset.qualityScore || 0) < 50 ? 'text-red-700' : 
                          (asset.qualityScore || 0) < 80 ? 'text-amber-700' : 
                          'text-green-700'
                        }`}>{asset.qualityScore}%</span>
                      </div>
                      
                      {/* Tooltip de Health Score expandido */}
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover/score:block z-50 w-48 p-3 bg-[#1B3A8C] text-white rounded-xl shadow-2xl border border-blue-400/30 backdrop-blur-md">
                        <p className="text-[9px] font-black uppercase tracking-widest mb-2 border-b border-white/20 pb-1">Health Distribution</p>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[8px] font-bold">
                            <span>Completude</span>
                            <span>{Math.round((asset.qualityScore || 0) * 1.05 > 100 ? 100 : (asset.qualityScore || 0) * 1.05)}%</span>
                          </div>
                          <div className="flex justify-between text-[8px] font-bold">
                            <span>Governança</span>
                            <span>{asset.ownerId && asset.stewardId ? '100%' : '50%'}</span>
                          </div>
                          <div className="flex justify-between text-[8px] font-bold text-blue-300">
                            <span>Confiabilidade</span>
                            <span>Estável</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="gap-2 text-[#1B3A8C] hover:bg-blue-50 font-black h-8 px-3 rounded-full"
                      onClick={() => setSelectedAsset({...asset, consumerCount})}
                    >
                      <Users size={14} />
                      {consumerCount}
                      <MousePointer2 size={12} className="opacity-0 group-hover:opacity-40 transition-opacity" />
                    </Button>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className={`inline-block px-3 py-1 rounded-full border font-black text-xs ${
                      (asset.businessValueScore ?? 0) > 70 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-gray-50 border-gray-200 text-gray-600'
                    }`}>
                      {asset.businessValueScore || 0}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-xs font-bold gap-1.5"
                        onClick={() => openCreateContract(asset)}
                      >
                        <FileKey size={13} /> Contrato
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreHorizontal size={16} /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 shadow-2xl border-none">
                          <DropdownMenuItem className="text-xs font-bold gap-2" onClick={() => setSelectedAsset({...asset, consumerCount})}>
                            <BarChart3 size={14} /> Detalhes de Consumo
                          </DropdownMenuItem>
                          {isAdmin && (
                            <DropdownMenuItem className="text-xs font-bold gap-2" onClick={() => setEditAsset({...asset})}>
                              <Edit2 size={14} /> Editar Ativo
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-xs font-bold gap-2" onClick={() => setLocation("/dicionario")}>
                            <FileText size={14} /> Dicionário Global
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-xs font-bold gap-2" onClick={() => openLineage(asset)}>
                            <GitBranch size={14} /> Linhagem de Fluxo
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-xs font-bold gap-2" onClick={() => openCreateContract(asset)}>
                            <FileKey size={14} /> Novo Data Contract
                          </DropdownMenuItem>
                          {(user?.role === "admin" || user?.role === "data_steward") && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-xs font-bold gap-2 text-indigo-700" onClick={() => openAgentPanel(asset)}>
                                <Bot size={14} /> Executar Agentes
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-xs font-bold gap-2 text-blue-700" onClick={() => setAccessAsset(asset)}>
                            <Lock size={14} /> Solicitar Acesso
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Sheet de Insights de Consumo (Versão Premium Pro - Traduzida) */}
      <Sheet open={!!selectedAsset} onOpenChange={() => setSelectedAsset(null)}>
        <SheetContent className="sm:max-w-xl border-none shadow-2xl overflow-y-auto bg-slate-50/95 backdrop-blur-md p-0">
          {/* Header com Gradiente */}
          <div className="bg-gradient-to-r from-[#1B3A8C] to-[#0A1A4D] p-8 text-white">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20">
                  <Activity size={24} className="text-blue-300" />
                </div>
                <div>
                  <Badge className="bg-blue-400/20 text-blue-200 border-blue-400/30 text-[10px] uppercase font-black tracking-[0.2em] mb-1">
                    Inteligência de Consumo de Ativos
                  </Badge>
                  <SheetTitle className="text-3xl font-black text-white tracking-tight">{selectedAsset?.name}</SheetTitle>
                </div>
              </div>
            </div>
            <div className="flex gap-6 mt-4">
              <div>
                <p className="text-[10px] font-bold text-blue-300 uppercase opacity-60">Total de Consumidores</p>
                <p className="text-2xl font-black">{selectedAsset?.consumerCount}</p>
              </div>
              <div className="w-px h-10 bg-white/10 self-end" />
              <div>
                <p className="text-[10px] font-bold text-blue-300 uppercase opacity-60">Valor de Negócio</p>
                <p className="text-2xl font-black text-amber-400">{selectedAsset?.businessValueScore}%</p>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-10">
            {/* Alerta de Impacto Executivo */}
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
              <div className="relative p-6 bg-white rounded-2xl border border-amber-100 shadow-sm flex items-start gap-4">
                <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                  <Zap size={24} className="fill-amber-600" />
                </div>
                <div>
                  <h4 className="font-black text-amber-900 text-sm">Dependência Crítica Detectada</h4>
                  <p className="text-xs text-amber-800/70 leading-relaxed mt-1.5">
                    Este ativo é classificado como <strong>Transversal (Cross-Domain)</strong>. Qualquer indisponibilidade afetará múltiplos fluxos de decisão na diretoria executiva.
                  </p>
                </div>
              </div>
            </div>

            {/* Grid de Métricas Principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Dashboards Dependentes */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Monitor size={14} className="text-blue-600" /> Análise de Dependências
                  </h4>
                  <Badge variant="outline" className="text-[9px] font-bold">{consumptionMetrics.dashboards.length} Ativos</Badge>
                </div>
                <div className="space-y-3">
                  {consumptionMetrics.dashboards.map((dash) => (
                    <div key={dash.name} className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-default">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${dash.type === 'Power BI' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                          <BarChart3 size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-black text-gray-800 tracking-tight">{dash.name}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase">{dash.type} • {dash.area}</p>
                        </div>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${dash.impact === 'Crítico' ? 'bg-red-500' : 'bg-blue-400'} animate-pulse`} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Uso por Departamento */}
              <div className="space-y-4">
                <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Building2 size={14} className="text-blue-600" /> Uso por Departamento
                </h4>
                <div className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
                   <div className="space-y-6">
                    {consumptionMetrics.areas.map((item) => (
                      <div key={item.name} className="space-y-2">
                        <div className="flex justify-between items-end">
                          <span className="text-[11px] font-black text-gray-700 uppercase">{item.name}</span>
                          <span className="text-xs font-black text-blue-900">{item.weight}%</span>
                        </div>
                        <div className="h-2 w-full bg-gray-50 rounded-full overflow-hidden">
                          <div 
                            className="h-full transition-all duration-1000 ease-out" 
                            style={{ width: `${item.weight}%`, backgroundColor: item.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Gráfico de Tendência Premium */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <TrendingUp size={14} className="text-green-600" /> Tendência de Consumo (Lake)
                </h4>
                <Badge className="bg-green-100 text-green-700 border-none font-black text-[9px] uppercase tracking-tighter">+24% de Crescimento</Badge>
              </div>
              <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={consumptionMetrics.history}>
                    <defs>
                      <linearGradient id="colorAcessos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1B3A8C" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#1B3A8C" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 'bold'}} />
                    <YAxis hide />
                    <Tooltip 
                      contentStyle={{ 
                        borderRadius: '16px', 
                        border: 'none', 
                        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                        padding: '12px'
                      }}
                      itemStyle={{ color: '#1B3A8C', fontWeight: '900' }}
                    />
                    <Area type="monotone" dataKey="acessos" stroke="#1B3A8C" strokeWidth={4} fillOpacity={1} fill="url(#colorAcessos)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Rodapé com Ações Pro */}
            <div className="pt-8 border-t border-gray-200 grid grid-cols-2 gap-4">
              <Button 
                variant="outline"
                className="h-12 rounded-xl font-black gap-2 text-xs border-gray-200 hover:bg-white hover:border-blue-600 hover:text-blue-600 transition-all shadow-sm"
                onClick={() => setLocation("/dicionario")}
              >
                <FileText size={16} /> Dicionário de Dados
              </Button>
              <Button 
                className="h-12 rounded-xl bg-[#1B3A8C] hover:bg-[#0A1A4D] font-black gap-2 text-xs shadow-lg shadow-blue-900/20"
                onClick={() => selectedAsset && openLineage(selectedAsset)}
              >
                <GitBranch size={16} /> Mapa de Linhagem Completa
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialog: Solicitar Acesso — Wizard 3 etapas */}
      <Dialog open={!!accessAsset} onOpenChange={(open) => { if (!open) resetAccessModal(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader className="pb-0">
            <DialogTitle className="flex items-center gap-2 text-[#1B3A8C]">
              <Lock size={18} /> Solicitar Acesso ao Ativo
            </DialogTitle>
            {/* Indicador de progresso */}
            <div className="flex items-center pt-3 gap-1">
              {[{ n: 1, label: "Matriz de Acesso" }, { n: 2, label: "Checklist de Segurança" }, { n: 3, label: "Revisão & Envio" }].map((s, i, arr) => (
                <div key={s.n} className="flex items-center gap-1 flex-1">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${accessStep > s.n ? "bg-green-500 text-white" : accessStep === s.n ? "bg-[#1B3A8C] text-white" : "bg-gray-200 text-gray-400"}`}>
                      {accessStep > s.n ? "✓" : s.n}
                    </div>
                    <span className={`text-xs font-semibold hidden sm:block ${accessStep === s.n ? "text-[#1B3A8C]" : accessStep > s.n ? "text-green-600" : "text-gray-400"}`}>{s.label}</span>
                  </div>
                  {i < arr.length - 1 && <div className={`flex-1 h-px mx-1 ${accessStep > s.n ? "bg-green-400" : "bg-gray-200"}`} />}
                </div>
              ))}
            </div>
          </DialogHeader>

          {/* Cabeçalho do ativo — sempre visível */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#1B3A8C] text-white flex items-center justify-center text-[10px] font-black shrink-0">
              {accessAsset?.region === "Brasil" ? "BR" : accessAsset?.region === "Europa" ? "EU" : "NA"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-gray-900 truncate">{accessAsset?.name}</p>
              <p className="text-xs text-gray-500">{accessAsset?.sourceSystem} · {accessAsset?.region}</p>
            </div>
            <Badge className="bg-blue-100 text-blue-800 border-none text-[10px] font-bold shrink-0">{accessAsset?.qualityScore}% Saúde</Badge>
          </div>

          {/* ══════════════ ETAPA 1: Matriz de Acesso ══════════════ */}
          {accessStep === 1 && (
            <div className="space-y-5">
              {/* Nível de Acesso */}
              <div className="space-y-3">
                <Label className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <UserCheck size={15} className="text-blue-600" /> Nível de Acesso Solicitado <span className="text-red-500">*</span>
                </Label>
                <RadioGroup value={accessForm.nivelAcesso} onValueChange={(v) => setAccessForm(f => ({ ...f, nivelAcesso: v }))} className="space-y-2">
                  <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${accessForm.nivelAcesso === "leitura" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <RadioGroupItem value="leitura" className="mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-gray-900">Leitura <span className="font-normal text-gray-400 text-xs">(colunas não sensíveis)</span></p>
                      <p className="text-xs text-gray-500 mt-0.5">Somente leitura. Dados pessoais e financeiros serão mascarados. Prioridade gerada: <strong>Média</strong>.</p>
                    </div>
                  </label>
                  <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${accessForm.nivelAcesso === "leitura_escrita" ? "border-amber-500 bg-amber-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <RadioGroupItem value="leitura_escrita" className="mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-gray-900">Leitura e Escrita</p>
                      <p className="text-xs text-gray-500 mt-0.5">Leitura e alteração de registros. Requer aprovação adicional do Data Steward. Prioridade gerada: <strong className="text-amber-600">Alta</strong>.</p>
                    </div>
                  </label>
                </RadioGroup>
              </div>

              <Separator />

              {/* Papel / Grupo */}
              <div className="space-y-2">
                <Label htmlFor="papelGrupo" className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <Users size={15} className="text-blue-600" /> Papel / Grupo do Usuário <span className="text-red-500">*</span>
                </Label>
                <Input id="papelGrupo" placeholder="Ex: Gerente Regional de Vendas, Cientista de Dados, Analista de RH..." value={accessForm.papelGrupo} onChange={(e) => setAccessForm(f => ({ ...f, papelGrupo: e.target.value }))} className="text-sm" />
                <p className="text-xs text-gray-400">Informe o papel ou grupo que terá acesso (conforme a Matriz RACI do domínio).</p>
              </div>

              <Separator />

              {/* Base Legal */}
              <div className="space-y-3">
                <Label className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <FileKey size={15} className="text-blue-600" /> Base Legal (LGPD — Art. 7º) <span className="text-red-500">*</span>
                </Label>
                <RadioGroup value={accessForm.baseLegal} onValueChange={(v) => setAccessForm(f => ({ ...f, baseLegal: v }))} className="space-y-2">
                  <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${accessForm.baseLegal === "legitimo_interesse" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <RadioGroupItem value="legitimo_interesse" className="mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-gray-900">Legítimo Interesse</p>
                      <p className="text-xs text-gray-500 mt-0.5">Tratamento necessário para os interesses legítimos da empresa, desde que não prevaleçam os do titular (Art. 7º, IX). Validado pela Privacy Champion.</p>
                    </div>
                  </label>
                  <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${accessForm.baseLegal === "execucao_contrato" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <RadioGroupItem value="execucao_contrato" className="mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-gray-900">Execução de Contrato</p>
                      <p className="text-xs text-gray-500 mt-0.5">Tratamento necessário para execução de contrato do qual o titular é parte (Art. 7º, V). Validado pelo Departamento Jurídico.</p>
                    </div>
                  </label>
                </RadioGroup>
              </div>

              <Separator />

              {/* Justificativa */}
              <div className="space-y-2">
                <Label htmlFor="finalidade" className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <AlertTriangle size={15} className="text-amber-500" /> Justificativa de Negócio <span className="text-red-500">*</span>
                </Label>
                <Textarea id="finalidade" placeholder="Descreva a finalidade, quais decisões serão suportadas, quais relatórios serão gerados e como os dados serão tratados..." rows={3} value={accessForm.finalidade} onChange={(e) => setAccessForm(f => ({ ...f, finalidade: e.target.value }))} className="resize-none text-sm" />
                <p className="text-xs text-gray-400">Mínimo de 10 caracteres. Descrições vagas podem levar à reprovação pelo Data Owner.</p>
              </div>

              {/* Prazo */}
              <div className="space-y-2">
                <Label htmlFor="prazo" className="text-sm font-bold text-gray-800">Prazo de Necessidade <span className="text-gray-400 font-normal text-xs">(opcional)</span></Label>
                <Input id="prazo" placeholder="Ex: 30 dias, permanente, até 31/12/2026..." value={accessForm.prazoNecessidade} onChange={(e) => setAccessForm(f => ({ ...f, prazoNecessidade: e.target.value }))} className="text-sm" />
              </div>
            </div>
          )}

          {/* ══════════════ ETAPA 2: Checklist de Segurança ══════════════ */}
          {accessStep === 2 && (
            <div className="space-y-5">
              {/* Aviso */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-3">
                <ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  Preencha em conjunto com o <strong>Privacy Champion</strong> e o <strong>Time Técnico</strong>, garantindo conformidade com a LGPD e os padrões de segurança da VC. Para cada item, selecione <strong>Sim</strong>, <strong>Não</strong> ou <strong>N/A</strong>.
                </p>
              </div>

              {/* Helper visual: legenda dos botões */}
              <div className="flex items-center gap-3 text-[10px] text-gray-500 px-1">
                <span className="font-semibold">Legenda:</span>
                <span className="flex items-center gap-1"><span className="inline-block w-7 text-center rounded border border-green-400 text-green-700 font-bold bg-green-50 py-0.5">Sim</span> Atendido</span>
                <span className="flex items-center gap-1"><span className="inline-block w-7 text-center rounded border border-red-400 text-red-700 font-bold bg-red-50 py-0.5">Não</span> Pendente</span>
                <span className="flex items-center gap-1"><span className="inline-block w-8 text-center rounded border border-gray-300 text-gray-500 font-bold bg-gray-50 py-0.5">N/A</span> Não se aplica</span>
              </div>

              {/* Seção 1 — Conformidade e Governança */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-[#1B3A8C] text-white text-xs font-black flex items-center justify-center shrink-0">1</div>
                  <h4 className="text-sm font-bold text-gray-900">Conformidade e Governança</h4>
                  <Badge variant="outline" className={`ml-auto text-[9px] font-bold shrink-0 ${sec1Done ? "border-green-400 text-green-700 bg-green-50" : "border-gray-200 text-gray-400"}`}>
                    {sec1Done ? "✓ Completo" : `${SEC1.filter(i => accessForm.checklist[i.id]?.resp).length}/${SEC1.length}`}
                  </Badge>
                </div>
                {SEC1.map(item => {
                  const resp = accessForm.checklist[item.id]?.resp;
                  return (
                    <div key={item.id} className={`rounded-lg border transition-all overflow-hidden ${resp ? "border-blue-200" : "border-gray-200"}`}>
                      {/* Linha da pergunta */}
                      <div className={`flex items-start gap-2.5 p-3 ${resp ? "bg-blue-50/50" : "bg-white"}`}>
                        <span className="shrink-0 mt-0.5 text-[10px] font-black text-gray-400 w-6 text-right tabular-nums">{item.id}</span>
                        <p className="text-sm text-gray-800 leading-relaxed flex-1">{item.crit}</p>
                      </div>
                      {/* Linha de ação: responsável + botões */}
                      <div className={`flex items-center justify-between px-3 py-2 border-t ${resp ? "border-blue-100 bg-blue-50/30" : "border-gray-100 bg-gray-50/60"}`}>
                        <p className="text-[10px] text-gray-400 italic truncate pr-2">Resp.: {item.owner}</p>
                        <div className="flex gap-1 shrink-0">
                          {(["sim", "nao", "na"] as CLA[]).map(opt => (
                            <button key={opt} type="button" onClick={() => setCLResp(item.id, opt)}
                              className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-all min-w-[36px] ${resp === opt
                                ? opt === "sim" ? "bg-green-500 text-white border-green-500 shadow-sm" : opt === "nao" ? "bg-red-500 text-white border-red-500 shadow-sm" : "bg-gray-500 text-white border-gray-500 shadow-sm"
                                : "border-gray-200 text-gray-500 hover:border-gray-400 hover:bg-gray-100 bg-white"}`}>
                              {opt === "sim" ? "Sim" : opt === "nao" ? "Não" : "N/A"}
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* Campo de evidência */}
                      {resp && (
                        <div className="px-3 pb-3 pt-1 bg-blue-50/30">
                          <Input placeholder="Evidência ou comentário (opcional)..." value={accessForm.checklist[item.id].evidencia} onChange={(e) => setCLEvid(item.id, e.target.value)} className="text-xs h-7 bg-white" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Seção 2 — Segurança Técnica */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-[#1B3A8C] text-white text-xs font-black flex items-center justify-center shrink-0">2</div>
                  <h4 className="text-sm font-bold text-gray-900">Segurança Técnica e Controle de Acesso</h4>
                  <Badge variant="outline" className={`ml-auto text-[9px] font-bold shrink-0 ${sec2Done ? "border-green-400 text-green-700 bg-green-50" : "border-gray-200 text-gray-400"}`}>
                    {sec2Done ? "✓ Completo" : `${SEC2.filter(i => accessForm.checklist[i.id]?.resp).length}/${SEC2.length}`}
                  </Badge>
                </div>
                {SEC2.map(item => {
                  const resp = accessForm.checklist[item.id]?.resp;
                  return (
                    <div key={item.id} className={`rounded-lg border transition-all overflow-hidden ${resp ? "border-blue-200" : "border-gray-200"}`}>
                      <div className={`flex items-start gap-2.5 p-3 ${resp ? "bg-blue-50/50" : "bg-white"}`}>
                        <span className="shrink-0 mt-0.5 text-[10px] font-black text-gray-400 w-6 text-right tabular-nums">{item.id}</span>
                        <p className="text-sm text-gray-800 leading-relaxed flex-1">{item.crit}</p>
                      </div>
                      <div className={`flex items-center justify-between px-3 py-2 border-t ${resp ? "border-blue-100 bg-blue-50/30" : "border-gray-100 bg-gray-50/60"}`}>
                        <p className="text-[10px] text-gray-400 italic truncate pr-2">Resp.: {item.owner}</p>
                        <div className="flex gap-1 shrink-0">
                          {(["sim", "nao", "na"] as CLA[]).map(opt => (
                            <button key={opt} type="button" onClick={() => setCLResp(item.id, opt)}
                              className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-all min-w-[36px] ${resp === opt
                                ? opt === "sim" ? "bg-green-500 text-white border-green-500 shadow-sm" : opt === "nao" ? "bg-red-500 text-white border-red-500 shadow-sm" : "bg-gray-500 text-white border-gray-500 shadow-sm"
                                : "border-gray-200 text-gray-500 hover:border-gray-400 hover:bg-gray-100 bg-white"}`}>
                              {opt === "sim" ? "Sim" : opt === "nao" ? "Não" : "N/A"}
                            </button>
                          ))}
                        </div>
                      </div>
                      {resp && (
                        <div className="px-3 pb-3 pt-1 bg-blue-50/30">
                          <Input placeholder="Evidência ou comentário (opcional)..." value={accessForm.checklist[item.id].evidencia} onChange={(e) => setCLEvid(item.id, e.target.value)} className="text-xs h-7 bg-white" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Seção 3 — Terceiros (condicional) */}
              <div className="border rounded-xl overflow-hidden">
                <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 hover:bg-gray-100 transition-colors">
                  <Checkbox checked={accessForm.envolveTerceiros} onCheckedChange={(v) => setAccessForm(f => ({ ...f, envolveTerceiros: !!v }))} />
                  <div>
                    <p className="text-sm font-bold text-gray-800">Envolve fornecedor / terceiro?</p>
                    <p className="text-xs text-gray-500">Marque se os dados serão acessados ou processados por empresa ou sistema externo à VC.</p>
                  </div>
                </label>
                {accessForm.envolveTerceiros && (
                  <div className="space-y-2 p-3 border-t bg-white">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-md bg-red-600 text-white text-xs font-black flex items-center justify-center shrink-0">3</div>
                      <h4 className="text-sm font-bold text-gray-900">Gestão de Terceiros</h4>
                      <Badge variant="outline" className={`ml-auto text-[9px] font-bold shrink-0 ${sec3Done ? "border-green-400 text-green-700 bg-green-50" : "border-gray-200 text-gray-400"}`}>
                        {sec3Done ? "✓ Completo" : `${SEC3.filter(i => accessForm.checklist[i.id]?.resp).length}/${SEC3.length}`}
                      </Badge>
                    </div>
                    {SEC3.map(item => {
                      const resp = accessForm.checklist[item.id]?.resp;
                      return (
                        <div key={item.id} className={`rounded-lg border transition-all overflow-hidden ${resp ? "border-red-200" : "border-gray-200"}`}>
                          <div className={`flex items-start gap-2.5 p-3 ${resp ? "bg-red-50/40" : "bg-white"}`}>
                            <span className="shrink-0 mt-0.5 text-[10px] font-black text-red-400 w-6 text-right tabular-nums">{item.id}</span>
                            <p className="text-sm text-gray-800 leading-relaxed flex-1">{item.crit}</p>
                          </div>
                          <div className={`flex items-center justify-between px-3 py-2 border-t ${resp ? "border-red-100 bg-red-50/20" : "border-gray-100 bg-gray-50/60"}`}>
                            <p className="text-[10px] text-gray-400 italic truncate pr-2">Resp.: {item.owner}</p>
                            <div className="flex gap-1 shrink-0">
                              {(["sim", "nao", "na"] as CLA[]).map(opt => (
                                <button key={opt} type="button" onClick={() => setCLResp(item.id, opt)}
                                  className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-all min-w-[36px] ${resp === opt
                                    ? opt === "sim" ? "bg-green-500 text-white border-green-500 shadow-sm" : opt === "nao" ? "bg-red-500 text-white border-red-500 shadow-sm" : "bg-gray-500 text-white border-gray-500 shadow-sm"
                                    : "border-gray-200 text-gray-500 hover:border-gray-400 hover:bg-gray-100 bg-white"}`}>
                                  {opt === "sim" ? "Sim" : opt === "nao" ? "Não" : "N/A"}
                                </button>
                              ))}
                            </div>
                          </div>
                          {resp && (
                            <div className="px-3 pb-3 pt-1 bg-red-50/20">
                              <Input placeholder="Evidência ou comentário (opcional)..." value={accessForm.checklist[item.id].evidencia} onChange={(e) => setCLEvid(item.id, e.target.value)} className="text-xs h-7 bg-white" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════ ETAPA 3: Revisão & Envio ══════════════ */}
          {accessStep === 3 && (
            <div className="space-y-4">
              {/* Resumo da Matriz */}
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-3">
                <h4 className="text-sm font-bold text-blue-900 flex items-center gap-2"><FileText size={14} /> Matriz de Acesso — Resumo</h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <div><span className="text-gray-500">Ativo:</span> <strong>{accessAsset?.name}</strong></div>
                  <div><span className="text-gray-500">Sistema:</span> <strong>{accessAsset?.sourceSystem}</strong></div>
                  <div><span className="text-gray-500">Região:</span> <strong>{accessAsset?.region}</strong></div>
                  <div><span className="text-gray-500">Papel/Grupo:</span> <strong>{accessForm.papelGrupo}</strong></div>
                  <div>
                    <span className="text-gray-500">Nível:</span>{" "}
                    <strong className={accessForm.nivelAcesso === "leitura_escrita" ? "text-amber-700" : "text-blue-700"}>
                      {accessForm.nivelAcesso === "leitura" ? "Leitura (colunas não sensíveis)" : "Leitura e Escrita"}
                    </strong>
                  </div>
                  <div><span className="text-gray-500">Base Legal:</span> <strong>{accessForm.baseLegal === "legitimo_interesse" ? "Legítimo Interesse" : "Execução de Contrato"}</strong></div>
                  {accessForm.prazoNecessidade && (
                    <div className="col-span-2"><span className="text-gray-500">Prazo:</span> <strong>{accessForm.prazoNecessidade}</strong></div>
                  )}
                  <div className="col-span-2 border-t pt-2">
                    <span className="text-gray-500">Justificativa:</span>
                    <p className="text-gray-800 mt-0.5 leading-relaxed">{accessForm.finalidade}</p>
                  </div>
                </div>
              </div>

              {/* Resultado do Checklist */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wide">Resultado do Checklist de Segurança</h4>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Conformidade e Governança", items: SEC1, done: sec1Done },
                    { label: "Segurança Técnica", items: SEC2, done: sec2Done },
                    ...(accessForm.envolveTerceiros ? [{ label: "Gestão de Terceiros", items: SEC3, done: sec3Done }] : []),
                  ].map(sec => {
                    const sims = sec.items.filter(i => accessForm.checklist[i.id]?.resp === "sim").length;
                    const naos = sec.items.filter(i => accessForm.checklist[i.id]?.resp === "nao").length;
                    const nas = sec.items.filter(i => accessForm.checklist[i.id]?.resp === "na").length;
                    return (
                      <div key={sec.label} className={`p-3 border rounded-xl text-center space-y-1 ${sec.done ? "border-green-200 bg-green-50" : "border-gray-200"}`}>
                        <p className="text-[10px] font-bold text-gray-600 leading-tight">{sec.label}</p>
                        <div className="flex justify-center gap-2 text-xs font-black">
                          <span className="text-green-600">{sims}S</span>
                          <span className="text-red-500">{naos}N</span>
                          <span className="text-gray-400">{nas}NA</span>
                        </div>
                        {sec.done && <CheckCircle size={14} className="text-green-500 mx-auto" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Aviso de responsabilidade */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
                <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 space-y-1">
                  <p className="font-bold">Declaração de Responsabilidade</p>
                  <p className="leading-relaxed">Ao confirmar, você declara que todas as informações são verdadeiras, que está ciente das suas responsabilidades perante a <strong>LGPD</strong> e as políticas internas da Lucid Data Governance, e que utilizará os dados exclusivamente para a finalidade declarada.</p>
                  <p>Prioridade do ticket: <strong className={accessForm.nivelAcesso === "leitura_escrita" ? "text-amber-700" : "text-blue-700"}>{accessForm.nivelAcesso === "leitura_escrita" ? "Alta" : "Média"}</strong> · Aprovação: <strong>Data Owner do domínio {accessAsset?.region}</strong></p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            {accessStep === 1 && <>
              <Button variant="outline" onClick={resetAccessModal}>Cancelar</Button>
              <Button className="bg-[#1B3A8C] hover:bg-[#0A1A4D]" disabled={!step1Valid} onClick={() => setAccessStep(2)}>
                Próximo: Checklist de Segurança →
              </Button>
            </>}
            {accessStep === 2 && <>
              <Button variant="outline" onClick={() => setAccessStep(1)}>← Voltar</Button>
              <Button className="bg-[#1B3A8C] hover:bg-[#0A1A4D]" disabled={!step2Valid} onClick={() => setAccessStep(3)}>
                Próximo: Revisão & Envio →
              </Button>
            </>}
            {accessStep === 3 && <>
              <Button variant="outline" onClick={() => setAccessStep(2)}>← Voltar</Button>
              <Button className="bg-green-700 hover:bg-green-800 gap-2" disabled={createAccessRequest.isPending} onClick={handleRequestAccess}>
                <CheckCircle size={14} />
                {createAccessRequest.isPending ? "Enviando..." : "Confirmar e Enviar Solicitação"}
              </Button>
            </>}
                    </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Painel de Agentes de Governança ──────────────────────────────────────────── */}
      <Dialog open={agentPanel.open} onOpenChange={(o) => { if (!agentPanel.running) setAgentPanel(p => ({ ...p, open: o })); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Bot size={16} className="text-indigo-600" />
              Pipeline de Agentes de Governança
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Ativo: <span className="font-semibold text-gray-700">{agentPanel.assetName}</span>
            </DialogDescription>
          </DialogHeader>

          {/* Barra de progresso geral */}
          {(agentPanel.running || agentPanel.done) && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{agentPanel.running ? "Executando pipeline..." : agentPanel.done ? "Pipeline concluído" : ""}</span>
                <span className="font-semibold">
                  {agentPanel.agents.filter(a => a.status === "completed" || a.status === "failed").length} / {agentPanel.agents.length}
                </span>
              </div>
              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    agentPanel.done && agentPanel.agents.some(a => a.status === "failed") ? "bg-red-500" :
                    agentPanel.done ? "bg-green-500" : "bg-indigo-500 animate-pulse"
                  }`}
                  style={{ width: `${(agentPanel.agents.filter(a => a.status === "completed" || a.status === "failed").length / agentPanel.agents.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Lista de agentes com status */}
          <div className="space-y-2">
            {agentPanel.agents.map((agent, idx) => (
              <div key={agent.name} className={`rounded-lg border p-3 transition-all ${
                agent.status === "running"   ? "border-indigo-300 bg-indigo-50" :
                agent.status === "completed" ? "border-green-200 bg-green-50" :
                agent.status === "failed"    ? "border-red-200 bg-red-50" :
                "border-gray-100 bg-gray-50"
              }`}>
                <div className="flex items-center gap-3">
                  <span className="text-lg w-7 text-center flex-shrink-0">{agent.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-800">{agent.label}</p>
                      <span className="text-[10px] text-gray-400">{AGENT_DEFS[idx]?.description}</span>
                    </div>
                    {agent.status === "running" && (
                      <p className="text-xs text-indigo-600 flex items-center gap-1 mt-0.5">
                        <Loader2 size={10} className="animate-spin" /> Processando...
                      </p>
                    )}
                    {agent.status === "completed" && agent.output && (
                      <p className="text-xs text-green-700 mt-0.5 line-clamp-2">{agent.output}</p>
                    )}
                    {agent.status === "failed" && (
                      <p className="text-xs text-red-600 mt-0.5">{agent.error ?? "Falha ao executar"}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {agent.status === "pending"   && <div className="w-5 h-5 rounded-full border-2 border-gray-300" />}
                    {agent.status === "running"   && <Loader2 size={18} className="text-indigo-500 animate-spin" />}
                    {agent.status === "completed" && <CheckCircle2 size={18} className="text-green-500" />}
                    {agent.status === "failed"    && <XCircle size={18} className="text-red-500" />}
                  </div>
                  {agent.durationMs && (
                    <span className="text-[10px] text-gray-400 flex-shrink-0">{(agent.durationMs / 1000).toFixed(1)}s</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Resumo final */}
          {agentPanel.done && agentPanel.summary && (
            <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-indigo-800 flex items-center gap-1.5">
                    <Sparkles size={12} /> Resumo do Pipeline
                  </p>
                  <p className="text-xs text-indigo-700 mt-1">{agentPanel.summary}</p>
                  {agentPanel.runId && (
                    <p className="text-[10px] text-indigo-400 mt-1 font-mono">Run ID: {agentPanel.runId}</p>
                  )}
                </div>
                {agentPanel.finalState && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-indigo-700 border-indigo-300 hover:bg-indigo-100 shrink-0 text-xs"
                    onClick={() => setAgentPanel(p => ({ ...p, reportOpen: true }))}
                  >
                    <FileBarChart2 size={13} /> Ver Relatório
                  </Button>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {!agentPanel.running && !agentPanel.done && (
              <Button
                className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={startAgents}
              >
                <Play size={14} /> Iniciar Pipeline
              </Button>
            )}
            {agentPanel.running && (
              <Button disabled className="gap-2 bg-indigo-400 text-white cursor-not-allowed">
                <Loader2 size={14} className="animate-spin" /> Executando...
              </Button>
            )}
            {agentPanel.done && (
              <Button variant="outline" className="gap-2" onClick={() => setAgentPanel(p => ({ ...p, open: false }))}>
                <X size={14} /> Fechar
              </Button>
            )}
            {!agentPanel.running && (
              <Button variant="ghost" size="sm" onClick={() => setAgentPanel(p => ({ ...p, open: false }))}>
                Cancelar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal de Relatório Detalhado do Run ID ───────────────────────────────── */}
      <Dialog open={agentPanel.reportOpen} onOpenChange={(o) => setAgentPanel(p => ({ ...p, reportOpen: o }))}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <FileBarChart2 size={18} className="text-indigo-600" />
                </div>
                <div>
                  <DialogTitle className="text-base">Relatório de Execução de Agentes</DialogTitle>
                  <DialogDescription className="text-xs mt-0.5">
                    Ativo: <span className="font-semibold text-gray-700">{agentPanel.assetName}</span>
                    {agentPanel.runId && (
                      <span className="ml-2 font-mono text-indigo-400">{agentPanel.runId}</span>
                    )}
                  </DialogDescription>
                </div>
              </div>
              <Button
                variant="ghost" size="sm"
                className="gap-1.5 text-gray-500 text-xs"
                onClick={() => {
                  if (agentPanel.runId) {
                    navigator.clipboard.writeText(agentPanel.runId);
                    toast.success("Run ID copiado!");
                  }
                }}
              >
                <Copy size={12} /> Copiar Run ID
              </Button>
            </div>
          </DialogHeader>

          {agentPanel.finalState && (() => {
            const fs = agentPanel.finalState!;
            const durationSec = fs.durationMs ? (fs.durationMs / 1000).toFixed(1) : "—";
            const riskColor = !fs.auditResult ? "text-gray-500" :
              fs.auditResult.riskScore >= 70 ? "text-red-600" :
              fs.auditResult.riskScore >= 40 ? "text-yellow-600" : "text-green-600";
            const complianceBadge = !fs.auditResult ? null :
              fs.auditResult.complianceStatus === "compliant" ? { label: "Conforme", cls: "bg-green-100 text-green-700 border-green-300" } :
              fs.auditResult.complianceStatus === "non_compliant" ? { label: "Não Conforme", cls: "bg-red-100 text-red-700 border-red-300" } :
              { label: "Revisão Necessária", cls: "bg-yellow-100 text-yellow-700 border-yellow-300" };
            return (
              <div className="mt-4 space-y-4">
                {/* Cards de KPI do relatório */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg border bg-indigo-50 p-3 text-center">
                    <p className="text-[10px] text-indigo-500 font-semibold uppercase tracking-wide">Duração</p>
                    <p className="text-xl font-bold text-indigo-700 mt-1">{durationSec}s</p>
                  </div>
                  <div className="rounded-lg border bg-blue-50 p-3 text-center">
                    <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-wide">Colunas PII</p>
                    <p className="text-xl font-bold text-blue-700 mt-1">{fs.piiScanResult?.piiCount ?? 0}</p>
                  </div>
                  <div className="rounded-lg border bg-purple-50 p-3 text-center">
                    <p className="text-[10px] text-purple-500 font-semibold uppercase tracking-wide">Score de Risco</p>
                    <p className={`text-xl font-bold mt-1 ${riskColor}`}>{fs.auditResult?.riskScore ?? "—"}/100</p>
                  </div>
                  <div className="rounded-lg border bg-gray-50 p-3 text-center">
                    <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">Conformidade</p>
                    {complianceBadge
                      ? <Badge variant="outline" className={`mt-1 text-[10px] ${complianceBadge.cls}`}>{complianceBadge.label}</Badge>
                      : <p className="text-sm text-gray-400 mt-1">—</p>
                    }
                  </div>
                </div>

                {/* Abas com detalhes por agente */}
                <Tabs defaultValue="classification">
                  <TabsList className="w-full grid grid-cols-4 h-8">
                    <TabsTrigger value="classification" className="text-xs gap-1"><Tag size={11} /> Classificação</TabsTrigger>
                    <TabsTrigger value="pii" className="text-xs gap-1"><ShieldAlertIcon size={11} /> PII</TabsTrigger>
                    <TabsTrigger value="documentation" className="text-xs gap-1"><ScrollText size={11} /> Documentação</TabsTrigger>
                    <TabsTrigger value="audit" className="text-xs gap-1"><ClipboardList size={11} /> Auditoria</TabsTrigger>
                  </TabsList>

                  {/* Aba: Classificação */}
                  <TabsContent value="classification" className="mt-3 space-y-3">
                    {fs.classificationResult ? (
                      <>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs font-semibold border-purple-300 text-purple-700 bg-purple-50">
                            {fs.classificationResult.sensitivity}
                          </Badge>
                          <span className="text-xs text-muted-foreground">Sensibilidade detectada</span>
                        </div>
                        {fs.classificationResult.tags.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-600 mb-1.5">Tags de Governança</p>
                            <div className="flex flex-wrap gap-1.5">
                              {fs.classificationResult.tags.map((tag, i) => (
                                <Badge key={i} variant="secondary" className="text-[10px]">{tag}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {fs.classificationResult.governancePolicies.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-600 mb-1.5">Políticas Aplicáveis</p>
                            <ul className="space-y-1">
                              {fs.classificationResult.governancePolicies.map((pol, i) => (
                                <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                                  <CheckCircle2 size={12} className="text-green-500 mt-0.5 shrink-0" />{pol}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {fs.classificationResult.reasoning && (
                          <div className="rounded-lg bg-gray-50 border p-3">
                            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Raciocínio do Agente</p>
                            <p className="text-xs text-gray-700 leading-relaxed">{fs.classificationResult.reasoning}</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">Classificação não disponível para este pipeline.</p>
                    )}
                  </TabsContent>

                  {/* Aba: PII */}
                  <TabsContent value="pii" className="mt-3 space-y-3">
                    {fs.piiScanResult ? (
                      <>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-xs font-semibold ${
                            fs.piiScanResult.piiCount > 0 ? "border-red-300 text-red-700 bg-red-50" : "border-green-300 text-green-700 bg-green-50"
                          }`}>
                            {fs.piiScanResult.piiCount} coluna(s) PII detectada(s)
                          </Badge>
                        </div>
                        {fs.piiScanResult.columns && fs.piiScanResult.columns.length > 0 ? (
                          <div className="rounded-lg border overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50 border-b">
                                <tr>
                                  <th className="text-left p-2 font-semibold text-gray-600">Coluna</th>
                                  <th className="text-left p-2 font-semibold text-gray-600">Tipo PII</th>
                                  <th className="text-right p-2 font-semibold text-gray-600">Confiança</th>
                                </tr>
                              </thead>
                              <tbody>
                                {fs.piiScanResult.columns.map((col, i) => (
                                  <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                                    <td className="p-2 font-mono text-gray-800">{col.name}</td>
                                    <td className="p-2">
                                      <Badge variant="outline" className="text-[10px] border-red-200 text-red-700">{col.piiType}</Badge>
                                    </td>
                                    <td className="p-2 text-right font-semibold text-gray-700">{Math.round((col.confidence ?? 0) * 100)}%</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2 py-8 text-center">
                            <CheckCircle2 size={32} className="text-green-400" />
                            <p className="text-sm font-medium text-green-700">Nenhuma coluna PII detectada</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">Scan PII não disponível para este pipeline.</p>
                    )}
                  </TabsContent>

                  {/* Aba: Documentação */}
                  <TabsContent value="documentation" className="mt-3 space-y-3">
                    {fs.documentationResult ? (
                      <>
                        {fs.documentationResult.reportMarkdown && (
                          <div>
                            <p className="text-xs font-semibold text-gray-600 mb-1.5">Relatório Gerado pelo Agente</p>
                            <div className="rounded-lg bg-gray-50 border p-3 max-h-48 overflow-y-auto">
                              <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">{fs.documentationResult.reportMarkdown}</pre>
                            </div>
                          </div>
                        )}
                        {fs.documentationResult.glossaryTerms && fs.documentationResult.glossaryTerms.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                              <BookMarked size={12} /> Termos do Glossário Sugeridos
                            </p>
                            <div className="space-y-2">
                              {fs.documentationResult.glossaryTerms.map((term, i) => (
                                <div key={i} className="rounded-lg border p-2.5 bg-white">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-bold text-gray-800">{term.term}</span>
                                    <Badge variant="outline" className="text-[10px]">{term.category}</Badge>
                                  </div>
                                  <p className="text-xs text-gray-600">{term.definition}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">Documentação não disponível para este pipeline.</p>
                    )}
                  </TabsContent>

                  {/* Aba: Auditoria */}
                  <TabsContent value="audit" className="mt-3 space-y-3">
                    {fs.auditResult ? (
                      <>
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-center justify-center w-16 h-16 rounded-full border-4 shrink-0 ${
                            fs.auditResult.riskScore >= 70 ? 'border-red-400' :
                            fs.auditResult.riskScore >= 40 ? 'border-yellow-400' : 'border-green-400'
                          }">
                            <span className={`text-lg font-black ${riskColor}`}>{fs.auditResult.riskScore}</span>
                            <span className="text-[9px] text-gray-400">risco</span>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-700">Score de Risco de Segurança</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {fs.auditResult.riskScore >= 70 ? "Risco alto — ação imediata recomendada" :
                               fs.auditResult.riskScore >= 40 ? "Risco médio — revisão recomendada" :
                               "Risco baixo — ativo em conformidade"}
                            </p>
                            {complianceBadge && (
                              <Badge variant="outline" className={`mt-1.5 text-[10px] ${complianceBadge.cls}`}>{complianceBadge.label}</Badge>
                            )}
                          </div>
                        </div>
                        {fs.auditResult.recommendations && fs.auditResult.recommendations.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-600 mb-1.5">Recomendações</p>
                            <ul className="space-y-1.5">
                              {fs.auditResult.recommendations.map((rec, i) => (
                                <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5 rounded-lg bg-yellow-50 border border-yellow-100 p-2">
                                  <AlertTriangle size={11} className="text-yellow-500 mt-0.5 shrink-0" />{rec}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {fs.auditResult.accessAlerts && fs.auditResult.accessAlerts.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-600 mb-1.5">Alertas de Acesso</p>
                            <ul className="space-y-1.5">
                              {fs.auditResult.accessAlerts.map((alert, i) => (
                                <li key={i} className="text-xs text-red-700 flex items-start gap-1.5 rounded-lg bg-red-50 border border-red-100 p-2">
                                  <XCircle size={11} className="text-red-500 mt-0.5 shrink-0" />{alert}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">Auditoria não disponível para este pipeline.</p>
                    )}
                  </TabsContent>
                </Tabs>

                {/* Metadados do run */}
                <div className="rounded-lg border bg-gray-50 p-3">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Metadados da Execução</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div><span className="text-gray-400">Run ID:</span> <span className="font-mono text-gray-700">{fs.runId}</span></div>
                    <div><span className="text-gray-400">Ativo ID:</span> <span className="text-gray-700">{fs.assetId ?? "—"}</span></div>
                    <div><span className="text-gray-400">Sistema:</span> <span className="text-gray-700">{fs.sourceSystem ?? "—"}</span></div>
                    <div><span className="text-gray-400">FQN:</span> <span className="font-mono text-gray-700 truncate">{fs.fullyQualifiedName ?? "—"}</span></div>
                    <div><span className="text-gray-400">Início:</span> <span className="text-gray-700">{fs.startedAt ? new Date(fs.startedAt).toLocaleString("pt-BR") : "—"}</span></div>
                    <div><span className="text-gray-400">Fim:</span> <span className="text-gray-700">{fs.completedAt ? new Date(fs.completedAt).toLocaleString("pt-BR") : "—"}</span></div>
                  </div>
                </div>
              </div>
            );
          })()}

          <DialogFooter className="mt-2">
            <Button variant="outline" size="sm" onClick={() => setAgentPanel(p => ({ ...p, reportOpen: false }))}>
              <X size={13} className="mr-1" /> Fechar Relatório
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
function StatCard({ label, value, icon: Icon, color, onClick }: any) {
  return (
    <Card
      className={`border-none shadow-sm bg-white border-b-4 border-b-blue-600 group hover:shadow-md transition-all ${
        onClick ? "cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-blue-200 hover:-translate-y-0.5" : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4 flex items-center justify-between relative">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
          <p className={`text-xl font-black mt-1 ${color || 'text-gray-900'}`}>{value}</p>
        </div>
        <div className="p-2 rounded-lg bg-gray-50 group-hover:bg-blue-50 transition-colors">
          <Icon className={`h-5 w-5 ${color || 'text-gray-200'}`} />
        </div>
        {onClick && <ChevronRight size={11} className="absolute bottom-2 right-2 text-gray-200" />}
      </CardContent>
    </Card>
  );
}
