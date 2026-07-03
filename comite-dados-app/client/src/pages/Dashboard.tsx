import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import {
  Users, CalendarDays, CheckSquare, Ticket,
  TrendingUp, UserCheck, Clock, ArrowRight,
  Building2, Shield, Bot, Database, FileBarChart, AlertTriangle,
  Info, Book, Scale, Activity, RefreshCw, HelpCircle, FileText, CheckCircle2,
  LayoutDashboard, GitBranch, Table2, BookText, Network,
  ShieldCheck, Lock, Bell, History, UserCog, Settings2, Download, Star,
  Zap, Target, MessageSquare, Inbox, ListChecks, Trophy,
  ShieldAlert, ClipboardCheck, BarChart3, BookOpen, Tag, Layers,
  Store, Gauge
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  LineChart, Line, Area, AreaChart,
} from "recharts";

const ROLE_LABELS: Record<string, string> = {
  data_owner: "Data Owner", data_steward: "Data Steward",
  product_owner: "Product Owner", project_manager: "Project Manager",
  ai_owner: "AI Owner", ai_steward: "AI Steward",
  ai_ethics_officer: "AI Ethics Officer", ml_engineer: "ML Engineer",
  model_manager: "Model Manager", data_engineer: "Data Engineer",
  data_architect: "Data Architect", facilitador: "Facilitador",
  representante_negocio: "Rep. Negócio", outro: "Outro",
};
const ROLE_COLORS: Record<string, string> = {
  data_owner: "#1B3A8C", data_steward: "#6366F1", product_owner: "#F59E0B",
  ai_owner: "#8B5CF6", ai_steward: "#7C3AED", ai_ethics_officer: "#EF4444",
  ml_engineer: "#06B6D4", model_manager: "#10B981", data_engineer: "#3B82F6",
  data_architect: "#64748B", facilitador: "#6DC23A", representante_negocio: "#EC4899",
};
const CRITICALITY_COLORS: Record<string, string> = {
  critica: "#dc2626", alta: "#f97316", media: "#facc15", baixa: "#22c55e",
};
const CRITICALITY_LABELS: Record<string, string> = {
  critica: "Crítica", alta: "Alta", media: "Média", baixa: "Baixa",
};
const STATUS_COLORS = ["#6DC23A", "#1B3A8C", "#F59E0B", "#64748B"];

const MeetingsTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const total = payload.reduce((sum, p) => sum + (p.value ?? 0), 0);
  const monthNames = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  let formattedLabel = label ?? "";
  if (label && /^\d{4}\/\d{2}$/.test(label)) {
    const [year, month] = label.split("/");
    formattedLabel = `${monthNames[parseInt(month, 10) - 1]}/${year}`;
  }
  return (
    <div style={{
      background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
      padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", minWidth: 160,
    }}>
      <p style={{ margin: "0 0 8px", fontWeight: 700, color: "#1B3A8C", fontSize: 13 }}>{formattedLabel}</p>
      {payload.map((p) => (
        <div key={p.name} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 4 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#374151" }}>
            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: p.color }} />
            {p.name}
          </span>
          <span style={{ fontWeight: 700, color: p.color }}>{p.value}</span>
        </div>
      ))}
      <div style={{ borderTop: "1px solid #f3f4f6", marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "#6B7280", fontSize: 11 }}>Total</span>
        <span style={{ fontWeight: 700, color: "#111827" }}>{total}</span>
      </div>
    </div>
  );
};

const MEETING_SERIES = [
  { key: 'Realizadas', color: '#1B3A8C', strokeDasharray: undefined },
  { key: 'Agendadas', color: '#6DC23A', strokeDasharray: undefined },
  { key: 'Canceladas', color: '#EF4444', strokeDasharray: '4 2' },
] as const;
type SeriesKey = typeof MEETING_SERIES[number]['key'];

const CustomMeetingsLegend = ({ hiddenSeries, onToggle }: {
  hiddenSeries: Set<SeriesKey>;
  onToggle: (key: SeriesKey) => void;
}) => (
  <div className="flex items-center gap-4 flex-wrap">
    {MEETING_SERIES.map(({ key, color }) => {
      const hidden = hiddenSeries.has(key);
      return (
        <button key={key} onClick={() => onToggle(key)} title={hidden ? `Exibir ${key}` : `Ocultar ${key}`}
          style={{ opacity: hidden ? 0.4 : 1 }}
          className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none transition-opacity hover:opacity-80 bg-transparent border-0 p-0">
          <span style={{ display: 'inline-block', width: 14, height: 3, borderRadius: 2, background: color }} />
          <span style={{ textDecoration: hidden ? 'line-through' : 'none', color: hidden ? '#9CA3AF' : '#374151' }}>{key}</span>
        </button>
      );
    })}
  </div>
);

// ── Dados estáticos para a aba de Documentação ────────────────────────────────
const modules = [
  { icon: LayoutDashboard, color: "text-blue-700", border: "border-l-blue-700", label: "Dashboard Central", href: "/", desc: "Painel central com KPIs do Lucid Data Governance: total de participantes, reuniões realizadas, tarefas abertas e tickets do ServiceNow. Gráficos de evolução de reuniões por mês, distribuição de papéis e status das tarefas. Acesso rápido às principais seções do sistema." },
  { icon: Users, color: "text-indigo-700", border: "border-l-indigo-700", label: "Organização do Comitê", href: "/organizacao", desc: "Cadastro e gerenciamento de todos os membros do Lucid Data Governance, visualização hierárquica em organograma e definição de responsabilidades via Matriz RACI." },
  { icon: Database, color: "text-cyan-700", border: "border-l-cyan-700", label: "Catálogo de Dados", href: "/catalogo", desc: "Inventário centralizado de todos os ativos de dados. Cada ativo exibe: nome técnico, nome de negócio, domínio, sistema de origem, classificação de sensibilidade, score de qualidade e score de valor de negócio." },
  { icon: BookText, color: "text-teal-700", border: "border-l-teal-700", label: "Dicionário & Curadoria", href: "/dicionario", desc: "Curadoria de ativos e atributos, classificação de PII, políticas de tags e políticas de mascaramento no Unity Catalog — tudo em um único painel com abas." },
  { icon: Network, color: "text-violet-700", border: "border-l-violet-700", label: "Linhagem de Dados", href: "/linhagem", desc: "Mapeamento visual do fluxo dos dados desde a origem até o consumo. Permite selecionar um nó para ver os ativos que passam por ele e simular impactos de mudança." },
  { icon: BookOpen, color: "text-emerald-700", border: "border-l-emerald-700", label: "Glossário Corporativo", href: "/glossario", desc: "Glossário oficial de termos de negócio. Cada verbete contém definição, abreviação, sinônimos, exemplos e status de aprovação pelo Comitê." },
  { icon: ShieldCheck, color: "text-green-700", border: "border-l-green-700", label: "Qualidade & SLA", href: "/qualidade", desc: "Monitoramento de qualidade dos ativos por dimensões (completude, unicidade, validade). Configuração de SLAs de dados e gestão de violações." },
  { icon: Lock, color: "text-rose-700", border: "border-l-rose-700", label: "Portal LGPD", href: "/portal-lgpd", desc: "Dashboard de conformidade LGPD, inventário de ativos sensíveis, RIPD, Avaliações de Impacto (PIA/DPIA) e gestão de Direitos dos Titulares (DSAR)." },
  { icon: Layers, color: "text-purple-700", border: "border-l-purple-700", label: "Autonomia & Acessos", href: "/autonomia-tiers", desc: "Modelo de Maturidade de Autonomia por Tier (1–4). Atribui políticas de acesso ao Unity Catalog por domínio com fluxo de aprovação e Sync Databricks." },
  { icon: CheckSquare, color: "text-orange-700", border: "border-l-orange-700", label: "Implantação por Domínio", href: "/implantacao", desc: "Roteiro estruturado para implementação de novos programas de governança. Divide o processo em fases com tarefas verificáveis e responsáveis por etapa." },
  { icon: Bot, color: "text-blue-500", border: "border-l-blue-500", label: "Assistente de IA", href: "/assistente-ia", desc: "Chatbot especializado em governança de dados corporativos. Responde perguntas sobre políticas internas, normas da LGPD, boas práticas de catalogação e Databricks." },
  { icon: CalendarDays, color: "text-sky-700", border: "border-l-sky-700", label: "Reuniões do Comitê", href: "/reunioes", desc: "Agendamento e gestão de reuniões. Tipos: Ordinária, Extraordinária, Piloto e Workshop. Geração automática de convites e detecção de conflitos de horário." },
  { icon: Inbox, color: "text-blue-600", border: "border-l-blue-600", label: "Gestão de Demandas", href: "/demandas", desc: "Portal de submissão e triagem de demandas ao Comitê (Intake) integrado à gestão de tickets ServiceNow. Priorização P1–P4 com 8 critérios ponderados." },
  { icon: ClipboardCheck, color: "text-emerald-600", border: "border-l-emerald-600", label: "Fila de Aprovações", href: "/aprovacoes", desc: "Fila de solicitações de acesso a dados para aprovação por Data Owners e Data Stewards. Inclui editor de workflows customizados de aprovação." },
  { icon: Bell, color: "text-yellow-600", border: "border-l-yellow-600", label: "Notificações", href: "/notificacoes", desc: "Central de alertas do sistema: tickets críticos, reuniões agendadas, aprovações pendentes e ativos com qualidade abaixo do limiar configurado." },
  { icon: Store, color: "text-slate-600", border: "border-l-slate-600", label: "Integrações & Conectores", href: "/integracoes", desc: "Gerenciamento de webhooks, chaves de API e conectores para fontes de dados externas (SAP HANA, Snowflake, Databricks, etc.)." },
  { icon: ShieldAlert, color: "text-gray-700", border: "border-l-gray-700", label: "Log de Auditoria", href: "/audit-log", desc: "Registro completo de todas as ações realizadas no portal, com filtros por tipo de ação, entidade e usuário. Exportação para CSV." },
];

const scoringRules = [
  {
    icon: Star, color: "border-l-amber-400", iconColor: "text-amber-500",
    title: "Score de Valor de Negócio",
    items: [
      { label: "Domínio crítico (financeiro, operacional)", pts: "+30 pts" },
      { label: "Classificação confidencial ou restrita", pts: "+25 pts" },
      { label: "Possui Data Owner designado", pts: "+20 pts" },
      { label: "Possui Data Steward designado", pts: "+15 pts" },
      { label: "Ativo com linhagem mapeada", pts: "+10 pts" },
    ],
  },
  {
    icon: ShieldCheck, color: "border-l-green-400", iconColor: "text-green-600",
    title: "Score de Saúde dos Dados",
    items: [
      { label: "Completude ≥ 95%", pts: "+40 pts" },
      { label: "Unicidade ≥ 99%", pts: "+30 pts" },
      { label: "Completude 80–94%", pts: "+20 pts" },
      { label: "Unicidade 95–98%", pts: "+15 pts" },
      { label: "Completude < 80%", pts: "0 pts" },
    ],
  },
  {
    icon: Trophy, color: "border-l-blue-400", iconColor: "text-blue-600",
    title: "Certificação de Ativo",
    items: [
      { label: "Score de Saúde ≥ 80", pts: "Requisito 1" },
      { label: "Score de Valor ≥ 60", pts: "Requisito 2" },
      { label: "Aprovado por Data Owner", pts: "Requisito 3" },
      { label: "Exibido com badge dourado", pts: "Resultado" },
      { label: "Recertificação a cada 90 dias", pts: "Validade" },
    ],
  },
];

const roles = [
  { role: "Data Owner", color: "bg-blue-100 text-blue-800", desc: "Responsável executivo e de negócio pelo domínio. Toma decisões sobre acesso, política de uso e classificação dos dados. Aprova solicitações de acesso e mudanças de classificação." },
  { role: "Data Steward", color: "bg-indigo-100 text-indigo-800", desc: "Responsável operacional pela qualidade e catalogação dos dados do domínio. Mantém o catálogo atualizado, valida metadados e é o ponto de contato técnico do dia a dia." },
  { role: "Product Owner", color: "bg-amber-100 text-amber-800", desc: "Representa os interesses do negócio no desenvolvimento de produtos de dados. Define prioridades e critérios de aceitação para os ativos do domínio." },
  { role: "AI Owner", color: "bg-purple-100 text-purple-800", desc: "Responsável executivo pelos modelos de IA do domínio. Garante alinhamento estratégico, conformidade com políticas de IA responsável e LGPD." },
  { role: "ML Engineer", color: "bg-cyan-100 text-cyan-800", desc: "Constrói e mantém pipelines de dados para ML. Atua na camada de transformação (Azure Data Factory / Databricks) e garante a rastreabilidade dos dados de treino." },
  { role: "Data Engineer", color: "bg-sky-100 text-sky-800", desc: "Desenvolve e mantém as integrações e pipelines de dados. Responsável pela ingestão de dados do SAP HANA, Salesforce e fontes IoT para o Snowflake." },
];

const automations = [
  { icon: RefreshCw, color: "text-purple-600", label: "MetadataScheduler", freq: "A cada 1 hora", desc: "Varre os conectores SAP HANA e Snowflake para descobrir novos ativos e sincronizar metadados com o catálogo. Ao final, aciona o QualityEngine e o pipeline de agentes de governança." },
  { icon: Activity, color: "text-green-600", label: "QualityEngine", freq: "Após cada ciclo de metadados", desc: "Executa testes de completude e unicidade em todos os ativos cadastrados. Persiste os resultados na tabela de qualidade e atualiza os scores exibidos no catálogo." },
  { icon: CalendarDays, color: "text-sky-600", label: "AttendanceScheduler", freq: "A cada 5 minutos", desc: "Sincroniza a presença de participantes em reuniões encerradas há 10 minutos ou mais, garantindo que as atas reflitam os presentes reais." },
  { icon: AlertTriangle, color: "text-red-600", label: "TicketAlertScheduler", freq: "Diariamente às 8h", desc: "Verifica tickets de alta e crítica prioridade sem atualização há mais de 7 dias e envia notificações automáticas para os responsáveis pelo domínio afetado." },
  { icon: Bot, color: "text-violet-600", label: "AgentOrchestrator", freq: "A cada ciclo de metadados", desc: "Executa o pipeline multiagente de governança (Inspeção → Classificação → Documentação → Auditoria) para cada ativo, gerando relatórios e scores de risco automáticos." },
];

const faqItems = [
  { q: "Como solicitar acesso a um ativo de dados?", a: "Acesse o Catálogo de Dados, localize o ativo desejado e clique em 'Solicitar Acesso'. Um modal será aberto para você informar a justificativa de negócio. Ao confirmar, um ticket é criado automaticamente no ServiceNow e o Data Owner do domínio recebe uma notificação para aprovação." },
  { q: "O que acontece quando um ticket de alta prioridade fica sem resposta?", a: "O TicketAlertScheduler executa diariamente às 8h e verifica tickets de prioridade Alta ou Crítica sem atualização há mais de 7 dias. Ao detectar, envia automaticamente notificações para os responsáveis pelo domínio afetado e registra o alerta no histórico de notificações." },
  { q: "Como funciona o sistema de prioridade P1-P4 nas demandas?", a: "Após a submissão, membros com papel de admin, Data Owner ou Data Steward realizam a triagem usando a Matriz de Priorização com 8 critérios: Impacto Financeiro (peso 10), Urgência/SLA (10), Alcance (8), Alinhamento Estratégico (8), Completude (6), Viabilidade Técnica (5), Potencial de Reuso (4) e Engajamento do Data Owner (4). O resultado define o tier: P1 (≥ 85 pts), P2 (≥ 70 pts), P3 (≥ 60 pts) ou P4 (< 60 pts, Backlog)." },
  { q: "Qual é a diferença entre Data Owner e Data Steward?", a: "O Data Owner é o responsável executivo e de negócio pelo domínio: toma decisões sobre acesso, política de uso e classificação dos dados. O Data Steward é o responsável operacional: mantém o catálogo atualizado, valida metadados e é o ponto de contato técnico do dia a dia." },
  { q: "Como as políticas PII são aplicadas no Unity Catalog?", a: "Após a detecção de colunas PII pelo scanner, o ativo entra em status 'Pendente de Revisão'. O Data Steward revisa o preview dos comandos SQL (MASKING, RLS, CLS) e pode aprovar ou rejeitar. Somente após a aprovação explícita o botão 'Sync Databricks' fica habilitado para aplicar as políticas." },
  { q: "O Assistente de IA tem acesso aos meus dados reais?", a: "Não. O Assistente de IA é um chatbot baseado em LLM treinado com documentações públicas sobre governança de dados, LGPD e boas práticas de plataforma. Ele não acessa o banco de dados da aplicação nem informações confidenciais dos ativos cadastrados." },
];

// ── Componente principal ──────────────────────────────────────────────────────
export default function Dashboard() {
  const { data: metrics, isLoading } = trpc.metrics.dashboard.useQuery();
  const { data: domains } = trpc.domains.list.useQuery();
  const { data: meetings } = trpc.meetings.list.useQuery({});
  const { data: tickets } = trpc.servicenow.list.useQuery({});

  const staleTickets = (tickets ?? []).filter((t) => {
    if (!t.priority || !['alta', 'critica'].includes(t.priority)) return false;
    if (!t.status || !['novo', 'em_andamento'].includes(t.status)) return false;
    if (!t.updatedAt) return false;
    const days = Math.floor((Date.now() - new Date(t.updatedAt).getTime()) / (24 * 60 * 60 * 1000));
    return days >= 7;
  });
  const [monthRange, setMonthRange] = useState<3 | 6 | 12>(6);
  const { data: meetingsByMonth } = trpc.metrics.meetingsByMonth.useQuery({ months: monthRange });
  const [isExportingReport, setIsExportingReport] = useState(false);
  const [hiddenSeries, setHiddenSeries] = useState<Set<SeriesKey>>(new Set());
  const { data: attendanceRate } = trpc.teams.attendanceRate.useQuery({ months: 6 });

  const toggleSeries = (key: SeriesKey) => {
    setHiddenSeries(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const exportMetricsMutation = trpc.export.metricsReportPDF.useMutation({
    onSuccess: (data) => {
      setIsExportingReport(false);
      window.open(data.url, "_blank");
      toast.success("Relatório de métricas exportado em PDF!");
    },
    onError: (e) => { setIsExportingReport(false); toast.error("Erro ao gerar relatório: " + e.message); },
  });

  const upcomingMeetings = meetings?.filter(m => m.status === 'agendada').slice(0, 3) ?? [];
  const roleData = (metrics?.roleDistribution ?? []).map(r => ({ name: ROLE_LABELS[r.role] ?? r.role, value: Number(r.count), color: ROLE_COLORS[r.role] ?? "#64748B" }));
  const domainData = (metrics?.domainProgress ?? []).map(d => ({ name: d.name, progresso: Math.round(Number(d.progress ?? 0)) }));
  const criticalityData = (metrics?.assetCriticality ?? []).filter(c => c.criticality !== null && c.criticality !== undefined).map(c => {
    const crit = c.criticality as keyof typeof CRITICALITY_LABELS;
    return { name: CRITICALITY_LABELS[crit] ?? String(c.criticality), value: Number(c.count), color: CRITICALITY_COLORS[crit] ?? "#64748B" };
  });
  const participationRate = metrics?.totalInvites ? Math.round((Number(metrics.confirmedInvites ?? 0) / Number(metrics.totalInvites)) * 100) : 0;

  const meetingsChartData = (meetingsByMonth ?? []).map(m => ({
    month: m.month,
    Realizadas: Number(m.realizada ?? 0),
    Agendadas: Number(m.agendada ?? 0),
    Canceladas: Number(m.cancelada ?? 0),
  }));

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B3A8C]">Dashboard Central</h1>
          <p className="text-sm text-gray-500 mt-0.5">Visão executiva e documentação da plataforma de governança</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setIsExportingReport(true); exportMetricsMutation.mutate(); }}
          disabled={isExportingReport}
          className="gap-2 text-[#1B3A8C] border-[#1B3A8C] hover:bg-blue-50"
        >
          <FileBarChart size={15} />
          {isExportingReport ? "Gerando..." : "Exportar Relatório"}
        </Button>
      </div>

      <Tabs defaultValue="visao-executiva" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="visao-executiva" className="gap-2">
            <LayoutDashboard size={16} />
            Visão Executiva
          </TabsTrigger>
          <TabsTrigger value="documentacao" className="gap-2">
            <Book size={16} />
            Documentação & Ajuda
          </TabsTrigger>
        </TabsList>

        {/* ── ABA 1: VISÃO EXECUTIVA ─────────────────────────────────────────── */}
        <TabsContent value="visao-executiva" className="space-y-6">
          {/* Alerta de tickets parados */}
          {staleTickets.length > 0 && (
            <Link href="/demandas">
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl cursor-pointer hover:bg-red-100 transition-colors">
                <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
                  <AlertTriangle size={18} className="text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-red-700">
                    {staleTickets.length} ticket{staleTickets.length !== 1 ? 's' : ''} de alta prioridade sem atualização há mais de 7 dias
                  </p>
                  <p className="text-xs text-red-500 mt-0.5">
                    {staleTickets.map(t => t.ticketNumber).join(', ')} — Clique para ver em Gestão de Demandas
                  </p>
                </div>
                <ArrowRight size={16} className="text-red-400 flex-shrink-0" />
              </div>
            </Link>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/organizacao">
            <Card className="border-0 shadow-sm bg-gradient-to-br from-[#1B3A8C] to-[#2A4FA8] text-white cursor-pointer hover:opacity-90 transition-opacity">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-white/20 rounded-lg"><Users size={18} className="text-white" /></div>
                  <span className="text-xs text-white/60 font-medium">Total</span>
                </div>
                <p className="text-3xl font-bold">{metrics?.totalParticipants ?? 0}</p>
                <p className="text-sm text-white/70 mt-1">Participantes</p>
                <p className="text-xs text-white/50 mt-1">{metrics?.activeParticipants ?? 0} ativos</p>
              </CardContent>
            </Card>
            </Link>
            <Link href="/organizacao">
            <Card className="border-0 shadow-sm bg-gradient-to-br from-[#6DC23A] to-[#5AAD2C] text-white cursor-pointer hover:opacity-90 transition-opacity">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-white/20 rounded-lg"><Building2 size={18} className="text-white" /></div>
                  <span className="text-xs text-white/60 font-medium">Ativos</span>
                </div>
                <p className="text-3xl font-bold">{metrics?.totalDomains ?? 0}</p>
                <p className="text-sm text-white/70 mt-1">Domínios</p>
                <p className="text-xs text-white/50 mt-1">Em implantação</p>
              </CardContent>
            </Card>
            </Link>
            <Link href="/reunioes">
            <Card className="border-0 shadow-sm bg-gradient-to-br from-[#7C3AED] to-[#6D28D9] text-white cursor-pointer hover:opacity-90 transition-opacity">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-white/20 rounded-lg"><CalendarDays size={18} className="text-white" /></div>
                  <span className="text-xs text-white/60 font-medium">Total</span>
                </div>
                <p className="text-3xl font-bold">{metrics?.totalMeetings ?? 0}</p>
                <p className="text-sm text-white/70 mt-1">Reuniões</p>
                <p className="text-xs text-white/50 mt-1">{metrics?.upcomingMeetings ?? 0} agendadas</p>
              </CardContent>
            </Card>
            </Link>
            <Link href="/reunioes">
            <Card className="border-0 shadow-sm bg-gradient-to-br from-[#F59E0B] to-[#D97706] text-white cursor-pointer hover:opacity-90 transition-opacity">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-white/20 rounded-lg"><UserCheck size={18} className="text-white" /></div>
                  <span className="text-xs text-white/60 font-medium">Taxa</span>
                </div>
                <p className="text-3xl font-bold">{participationRate}%</p>
                <p className="text-sm text-white/70 mt-1">Confirmações</p>
                <p className="text-xs text-white/50 mt-1">{metrics?.confirmedInvites ?? 0} de {metrics?.totalInvites ?? 0}</p>
              </CardContent>
            </Card>
            </Link>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border border-gray-100 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
                  <TrendingUp size={16} className="text-[#1B3A8C]" />
                  Progresso por Domínio
                </CardTitle>
              </CardHeader>
              <CardContent>
                {domainData.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm"><Building2 size={32} className="mx-auto mb-2 opacity-30" />Nenhum domínio cadastrado</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={domainData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                      <Tooltip formatter={(v) => [`${v}%`, 'Progresso']} />
                      <Bar dataKey="progresso" fill="#1B3A8C" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card className="border border-gray-100 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
                  <Users size={16} className="text-[#6DC23A]" />
                  Distribuição por Papel
                </CardTitle>
              </CardHeader>
              <CardContent>
                {roleData.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm"><Users size={32} className="mx-auto mb-2 opacity-30" />Nenhum participante cadastrado</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={roleData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                        {roleData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(value, name) => [value, name]} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Evolução de Reuniões */}
          <Card className="border border-gray-100 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
                  <CalendarDays size={16} className="text-[#1B3A8C]" />
                  Evolução de Reuniões
                </CardTitle>
                <div className="flex items-center gap-2">
                  <CustomMeetingsLegend hiddenSeries={hiddenSeries} onToggle={toggleSeries} />
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                    {([3, 6, 12] as const).map(n => (
                      <button key={n} onClick={() => setMonthRange(n)}
                        className={`px-3 py-1 text-xs font-medium transition-colors ${monthRange === n ? 'bg-[#1B3A8C] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                        {n}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {meetingsChartData.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm"><CalendarDays size={32} className="mx-auto mb-2 opacity-30" />Sem dados de reuniões</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={meetingsChartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={(v) => { if (/^\d{4}\/\d{2}$/.test(v)) { const [y, m] = v.split('/'); return ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][parseInt(m,10)-1]+'/'+y.slice(2); } return v; }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip content={<MeetingsTooltip />} />
                    {MEETING_SERIES.map(({ key, color, strokeDasharray }) => !hiddenSeries.has(key) && (
                      <Line key={key} type="monotone" dataKey={key} stroke={color} strokeWidth={2} dot={{ r: 3 }} strokeDasharray={strokeDasharray} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Domínios e Próximas Reuniões */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border border-gray-100 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
                    <Building2 size={16} className="text-[#1B3A8C]" />
                    Status dos Domínios
                  </CardTitle>
                  <Link href="/organizacao">
                    <span className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer">Ver todos <ArrowRight size={12} /></span>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {(domains ?? []).length === 0 ? (
                  <div className="text-center py-6 text-gray-400 text-sm"><Building2 size={28} className="mx-auto mb-2 opacity-30" />Nenhum domínio cadastrado</div>
                ) : (
                  (domains ?? []).slice(0, 5).map(domain => (
                    <div key={domain.id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-700">{domain.name}</span>
                        <span className="text-gray-500 text-xs">{Math.round(Number(domain.implementationProgress ?? 0))}%</span>
                      </div>
                      <Progress value={Number(domain.implementationProgress ?? 0)} className="h-1.5" />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card className="border border-gray-100 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
                    <Clock size={16} className="text-[#6DC23A]" />
                    Próximas Reuniões
                  </CardTitle>
                  <Link href="/reunioes">
                    <span className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer">Ver todas <ArrowRight size={12} /></span>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {upcomingMeetings.length === 0 ? (
                  <div className="text-center py-6 text-gray-400 text-sm"><CalendarDays size={28} className="mx-auto mb-2 opacity-30" />Nenhuma reunião agendada</div>
                ) : (
                  upcomingMeetings.map(meeting => (
                    <Link key={meeting.id} href={`/reunioes/${meeting.id}`}>
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-blue-50 cursor-pointer transition-colors">
                        <div className="p-2 bg-[#1B3A8C] rounded-lg flex-shrink-0"><CalendarDays size={14} className="text-white" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{meeting.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{new Date(meeting.scheduledAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <Badge variant="outline" className="text-xs flex-shrink-0 border-blue-200 text-blue-700">
                          {meeting.type === 'piloto' ? 'Piloto' : meeting.type === 'workshop' ? 'Workshop' : 'Ordinária'}
                        </Badge>
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Acesso Rápido */}
          <Card className="border border-gray-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-gray-800">Acesso Rápido</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {[
                  { href: "/organizacao", icon: Users, label: "Participantes", color: "bg-blue-50 text-blue-700 hover:bg-blue-100" },
                  { href: "/reunioes", icon: CalendarDays, label: "Agendar Reunião", color: "bg-green-50 text-green-700 hover:bg-green-100" },
                  { href: "/assistente-ia", icon: Bot, label: "Assistente IA", color: "bg-purple-50 text-purple-700 hover:bg-purple-100" },
                  { href: "/aprovacoes", icon: ClipboardCheck, label: "Aprovações", color: "bg-amber-50 text-amber-700 hover:bg-amber-100" },
                  { href: "/catalogo", icon: Database, label: "Catálogo", color: "bg-cyan-50 text-cyan-700 hover:bg-cyan-100" },
                  { href: "/portal-lgpd", icon: Shield, label: "Portal LGPD", color: "bg-rose-50 text-rose-700 hover:bg-rose-100" },
                ].map(({ href, icon: Icon, label, color }) => (
                  <Link key={href} href={href}>
                    <div className={`flex flex-col items-center gap-2 p-4 rounded-xl cursor-pointer transition-colors ${color}`}>
                      <Icon size={22} />
                      <span className="text-xs font-medium text-center">{label}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ABA 2: DOCUMENTAÇÃO & AJUDA ───────────────────────────────────── */}
        <TabsContent value="documentacao" className="space-y-10">
          {/* Módulos */}
          <section>
            <h2 className="text-xl font-bold text-[#1B3A8C] mb-1 flex items-center gap-2">
              <LayoutDashboard size={20} /> Módulos da Plataforma
            </h2>
            <p className="text-sm text-muted-foreground mb-5">Descrição detalhada de todos os módulos disponíveis no menu lateral.</p>
            <Accordion type="single" collapsible className="w-full space-y-2">
              {modules.map((mod, idx) => (
                <AccordionItem key={idx} value={`mod-${idx}`} className={`border-l-4 ${mod.border} rounded-lg border border-gray-200 px-4`}>
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-3">
                      <mod.icon size={20} className={mod.color} />
                      <span className="font-semibold text-gray-900">{mod.label}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-600 leading-relaxed pb-4 pl-8">
                    {mod.desc}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>

          {/* Scoring */}
          <section>
            <h2 className="text-xl font-bold text-[#1B3A8C] mb-1 flex items-center gap-2">
              <Target size={20} /> Lógica de Scoring & Certificação
            </h2>
            <p className="text-sm text-muted-foreground mb-5">Entenda como os scores de valor de negócio e saúde dos dados são calculados automaticamente.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {scoringRules.map((rule, idx) => (
                <Card key={idx} className={`border-l-4 ${rule.color} shadow-sm`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <rule.icon size={18} className={rule.iconColor} />
                      {rule.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {rule.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-gray-600">{item.label}</span>
                          <Badge variant="secondary" className="text-xs">{item.pts}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Papéis */}
          <section>
            <h2 className="text-xl font-bold text-[#1B3A8C] mb-1 flex items-center gap-2">
              <Users size={20} /> Papéis & Responsabilidades
            </h2>
            <p className="text-sm text-muted-foreground mb-5">Descrição de cada papel disponível no Lucid Data Governance.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roles.map((r, idx) => (
                <div key={idx} className="flex gap-4 p-4 border rounded-xl bg-white hover:bg-gray-50 transition-colors">
                  <Badge className={`${r.color} self-start mt-0.5 shrink-0`}>{r.role}</Badge>
                  <p className="text-sm text-gray-600 leading-relaxed">{r.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Automações */}
          <section>
            <h2 className="text-xl font-bold text-[#1B3A8C] mb-1 flex items-center gap-2">
              <Zap size={20} /> Automações & Agendamentos
            </h2>
            <p className="text-sm text-muted-foreground mb-5">Processos automáticos que rodam em background para manter os dados atualizados.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {automations.map((a, idx) => (
                <div key={idx} className="flex gap-4 p-4 border rounded-xl bg-white hover:bg-gray-50 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <a.icon size={18} className={a.color} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-gray-900">{a.label}</p>
                      <Badge variant="outline" className="text-xs">{a.freq}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{a.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* FAQ */}
          <section>
            <h2 className="text-xl font-bold text-[#1B3A8C] mb-1 flex items-center gap-2">
              <HelpCircle size={20} /> Perguntas Frequentes
            </h2>
            <p className="text-sm text-muted-foreground mb-5">Respostas para as dúvidas mais comuns dos usuários da plataforma.</p>
            <Accordion type="single" collapsible className="w-full space-y-2">
              {faqItems.map((item, idx) => (
                <AccordionItem key={idx} value={`faq-${idx}`} className="border rounded-xl px-4">
                  <AccordionTrigger className="hover:no-underline py-4 text-left font-semibold text-gray-900">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-600 leading-relaxed pb-4">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>

          {/* Download */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-8 bg-blue-50 border border-blue-100 rounded-2xl flex flex-col justify-between gap-6">
              <div>
                <h3 className="text-xl font-bold text-blue-900 flex items-center gap-2 mb-2">
                  <Download size={20} /> Manual Completo (PDF)
                </h3>
                <p className="text-sm text-blue-700 mb-1">Versão atualizada em junho de 2026</p>
                <p className="text-sm text-gray-600">Contém todos os módulos, regras de scoring, papéis e responsabilidades, FAQ e guias passo a passo desta documentação em formato offline.</p>
              </div>
              <div title="PDF em elaboração — disponível em breve" className="self-start px-6 py-3 bg-gray-200 text-gray-400 rounded-xl font-semibold flex items-center gap-2 cursor-not-allowed select-none">
                <Download size={16} /> Em breve — PDF em elaboração
              </div>
            </div>
            <div className="relative rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center p-10 text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-green-100 text-green-700 flex items-center justify-center">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Treinamento Concluído?</h3>
                <p className="text-muted-foreground mt-2 text-sm max-w-xs">Se você já domina as funcionalidades básicas, pode se candidatar a Multiplicador de Governança no seu domínio.</p>
              </div>
              <a href="https://vcimentos.csod.com/" target="_blank" rel="noopener noreferrer"
                className="px-5 py-2 bg-green-700 text-white rounded-xl hover:bg-green-800 transition-colors font-semibold flex items-center gap-2">
                Acessar Portal de Treinamento →
              </a>
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
