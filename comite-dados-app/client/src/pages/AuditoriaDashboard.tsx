import VCLayout from "@/components/VCLayout";
import { DataLineageGraph as LineageGraph } from "@/components/DataLineageGraph";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation, Link } from "wouter";
import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslation } from "@shared/i18n/translations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Database, FileText, Tag, Lock, GitBranch, Eye,
  CheckCircle2, XCircle, AlertTriangle, ArrowRight,
  Download, RefreshCw, TrendingUp, Shield, BarChart3,
  Clock, Layers, Users
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { cn } from "@/lib/utils";
import { CopilotChat } from "@/components/CopilotChat";
import { FinOpsPanel } from "@/components/FinOpsPanel";
import { SelfHealingPanel } from "@/components/SelfHealingPanel";
import { SecOpsPanel } from "@/components/SecOpsPanel";
import { FinOpsAIPanel } from "@/components/FinOpsAIPanel";
import { MonitoringPanel } from "@/components/MonitoringPanel";

const ANALYSIS_META = [
  { type: "structure", label: "Mapeamento de Estrutura", icon: Database, color: "text-info" },
  { type: "glossary", label: "Glossário de Dados", icon: FileText, color: "text-success" },
  { type: "tags", label: "Classificação por Tags", icon: Tag, color: "text-warning" },
  { type: "access", label: "Políticas de Acesso", icon: Lock, color: "text-gold" },
  { type: "lineage", label: "Linhagem de Dados", icon: GitBranch, color: "text-info" },
  { type: "security", label: "Segurança Dinâmica", icon: Eye, color: "text-success" },
];

function ScoreRing({ score }: { score: number }) {
  const r = 45;
  const circ = 2 * Math.PI * r;
  const offset = circ - (circ * score) / 100;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : score >= 40 ? "#f97316" : "#ef4444";

  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      <svg className="w-36 h-36 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-border" />
        <circle
          cx="50" cy="50" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.23,1,0.32,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold text-foreground">{score}</span>
        <span className="text-xs text-muted-foreground font-medium">/ 100</span>
      </div>
    </div>
  );
}

function ScoreLabel({ score, language }: { score: number; language: 'pt' | 'en' }) {
  if (score >= 80) return <span className="text-success font-semibold">{language === 'pt' ? 'Excelente' : 'Excellent'}</span>;
  if (score >= 60) return <span className="text-warning font-semibold">{language === 'pt' ? 'Bom' : 'Good'}</span>;
  if (score >= 40) return <span className="text-orange-400 font-semibold">{language === 'pt' ? 'Regular' : 'Fair'}</span>;
  return <span className="text-destructive font-semibold">{language === 'pt' ? 'Crítico' : 'Critical'}</span>;
}

export default function Dashboard() {
  const params = useParams<{ sessionId: string }>();
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const t = getTranslation(language);
  const sessionId = parseInt(params.sessionId ?? "0");

  useEffect(() => {
    if (!sessionId) {
      // Tentar pegar a última sessão executada salva no localStorage
      const storedConfig = localStorage.getItem("databricks_config");
      const lastSessionId = localStorage.getItem("last_audit_session_id");
      if (lastSessionId) {
        navigate(`/auditoria/report/${lastSessionId}`);
      } else {
        navigate("/auditoria/history");
      }
    }
  }, [sessionId, navigate]);

  const ANALYSIS_META = [
    { type: "structure", label: t.dashboard.structureAnalysis, icon: Database, color: "text-info" },
    { type: "glossary", label: t.dashboard.glossaryAnalysis, icon: FileText, color: "text-success" },
    { type: "tags", label: t.dashboard.tagsAnalysis, icon: Tag, color: "text-warning" },
    { type: "access", label: t.dashboard.accessAnalysis, icon: Lock, color: "text-gold" },
    { type: "lineage", label: t.dashboard.lineageAnalysis, icon: GitBranch, color: "text-info" },
    { type: "security", label: t.dashboard.securityAnalysis, icon: Eye, color: "text-success" },
  ];

  const queryKey = { sessionId };
  // Nota: os dois hooks são sempre chamados para respeitar as Rules of Hooks do React;
  // apenas um deles é habilitado conforme o ambiente (dev usa a rota pública).
  const isDev = import.meta.env.DEV;
  const publicQuery = trpc.auditoria.databricks.getSessionPublic.useQuery(queryKey, { enabled: !!sessionId && isDev, refetchInterval: false });
  const privateQuery = trpc.auditoria.databricks.getSession.useQuery(queryKey, { enabled: !!sessionId && !isDev, refetchInterval: false });
  const { data, isLoading, error } = isDev ? publicQuery : privateQuery;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
          <p className="text-muted-foreground">{language === 'pt' ? 'Carregando resultados...' : 'Loading results...'}</p>
        </div>
      </div>
    );
  }

  if (error || !data || !data.session) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <XCircle className="w-12 h-12 text-destructive mx-auto" />
          <p className="text-foreground font-semibold">{language === 'pt' ? 'Sessão não encontrada' : 'Session not found'}</p>
          <Button asChild variant="outline"><Link href="/history">{t.home.viewHistory}</Link></Button>
        </div>
      </div>
    );
  }

  const { session, analyses } = data;
  const score = Math.round(session.governanceScore ?? 0);

  const getAnalysisData = (type: string) => analyses.find((a: { analysisType: string }) => a.analysisType === type);

  const allRecs: string[] = [];
  const allGaps: string[] = [];
  analyses.forEach((a: { recommendations: unknown; gaps: unknown }) => {
    if (Array.isArray(a.recommendations)) allRecs.push(...(a.recommendations as string[]));
    if (Array.isArray(a.gaps)) allGaps.push(...(a.gaps as string[]));
  });
  const uniqueRecs = Array.from(new Set(allRecs));
  const uniqueGaps = Array.from(new Set(allGaps));

  const structureData = getAnalysisData("structure")?.resultData as any;
  const glossaryData = getAnalysisData("glossary")?.resultData as any;
  const tagsData = getAnalysisData("tags")?.resultData as any;
  const accessData = getAnalysisData("access")?.resultData as any;
  const lineageData = getAnalysisData("lineage")?.resultData as any;
  const securityData = getAnalysisData("security")?.resultData as any;

  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* SecOps Alert (Real-time) */}
      <SecOpsPanel />

        {/* Header */}
        <div className="flex items-start justify-between animate-fade-in-up">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-gold border-gold/30 bg-gold-subtle text-xs">
                Auditoria #{session.id}
              </Badge>
              <Badge variant="outline" className={cn("text-xs", session.status === "completed" ? "text-success border-success/30" : "text-destructive border-destructive/30")}>
                {session.status === "completed" ? "Concluída" : "Com erros"}
              </Badge>
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground">Dashboard Executivo</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {session.databricksHost} · Catálogo: <span className="text-gold font-mono">{session.targetCatalog}</span>
            </p>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="outline" size="sm" className="border-border hover:border-gold/40">
              <Link href={`/report/${sessionId}`}>
                <Download className="w-4 h-4 mr-2" />Exportar Relatório
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-gold/40 text-gold hover:bg-gold/10 hover:border-gold"
              onClick={() => {
                const a = document.createElement("a");
                a.href = `/api/report/${sessionId}/pdf`;
                a.download = `governance_report_${session.targetCatalog}_${new Date(session.createdAt).toISOString().slice(0, 10)}.pdf`;
                a.click();
              }}
            >
              <FileText className="w-4 h-4 mr-2" />Baixar PDF
            </Button>
            <Button asChild size="sm" className="gradient-gold text-white font-semibold">
              <Link href="/connect">
                <RefreshCw className="w-4 h-4 mr-2" />Nova Auditoria
              </Link>
            </Button>
          </div>
        </div>

        {/* Score + KPIs */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 animate-fade-in-up" style={{ animationDelay: "60ms" }}>
          {/* Score Card */}
          <div className="lg:col-span-1 bg-card border border-border rounded-2xl p-6 flex flex-col items-center justify-center gap-3 shadow-lg">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Score de Governança</p>
            <ScoreRing score={score} />
            <div className="text-center">
              <ScoreLabel score={score} language={language} />
              <p className="text-xs text-muted-foreground mt-1">Maturidade geral</p>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: "Catálogos", value: session.totalCatalogs ?? 0, icon: Layers, sub: "mapeados" },
              { label: "Schemas", value: session.totalSchemas ?? 0, icon: Database, sub: "encontrados" },
              { label: "Tabelas/Views", value: session.totalTables ?? 0, icon: BarChart3, sub: "analisadas" },
              { label: "Documentação", value: `${Math.round(session.docCoverage ?? 0)}%`, icon: FileText, sub: "cobertura" },
              { label: "Tags Aplicadas", value: `${Math.round(session.tagCoverage ?? 0)}%`, icon: Tag, sub: "cobertura" },
              { label: "Grants Totais", value: accessData?.summary?.totalGrants ?? "—", icon: Users, sub: "políticas" },
            ].map(({ label, value, icon: Icon, sub }, i) => (
              <div key={label} className="bg-card border border-border rounded-xl p-5 animate-fade-in-up" style={{ animationDelay: `${(i + 1) * 50}ms` }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-muted-foreground font-medium">{label}</p>
                  <div className="w-7 h-7 rounded-lg bg-gold-subtle flex items-center justify-center">
                    <Icon className="w-3.5 h-3.5 text-gold" />
                  </div>
                </div>
                <p className="font-display text-2xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Analysis Results Grid */}
        <div className="animate-fade-in-up" style={{ animationDelay: "120ms" }}>
          <h2 className="font-display text-xl font-bold text-foreground mb-5">Resultados das Análises</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ANALYSIS_META.map(({ type, label, icon: Icon, color }, i) => {
              const result = getAnalysisData(type);
              const ok = result?.status === "completed";
              const failed = result?.status === "failed";
              const rd = result?.resultData as any;

              let detail = "";
              if (type === "structure" && rd) detail = `${rd.summary?.totalCatalogs ?? 0} catálogos · ${rd.summary?.totalSchemas ?? 0} schemas · ${rd.summary?.totalTables ?? 0} tabelas`;
              if (type === "glossary" && rd) detail = `${rd.summary?.tableDocCoverage ?? 0}% tabelas · ${rd.summary?.columnDocCoverage ?? 0}% colunas documentadas`;
              if (type === "tags" && rd) detail = `${rd.summary?.totalTableTags ?? 0} tags em tabelas · ${rd.summary?.uniqueTags ?? 0} tags únicas`;
              if (type === "access" && rd) detail = `${rd.summary?.totalGrants ?? 0} grants · ${rd.summary?.uniqueGrantees ?? 0} grantees`;
              if (type === "lineage" && rd) detail = `${rd.summary?.totalEdges ?? 0} relações · ${rd.summary?.uniqueSources ?? 0} origens`;
              if (type === "security" && rd) detail = `${rd.summary?.totalFunctions ?? 0} funções · ${rd.summary?.rowFilterCount ?? 0} filtros de linha`;

              return (
                <div
                  key={type}
                  className="bg-card border border-border rounded-xl p-5 hover:border-gold/20 transition-all animate-fade-in-up"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-gold-subtle flex items-center justify-center">
                        <Icon className={cn("w-4 h-4", color)} />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Análise {i + 1}</p>
                        <p className="text-sm font-semibold text-foreground leading-tight">{label}</p>
                      </div>
                    </div>
                    {ok && <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />}
                    {failed && <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />}
                    {!result && <div className="w-4 h-4 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />}
                  </div>
                  {detail && <p className="text-xs text-muted-foreground leading-relaxed">{detail}</p>}
                  {failed && <p className="text-xs text-destructive mt-1">{result?.errorMessage ?? "Erro desconhecido"}</p>}
                  {result?.executionMs && (
                    <div className="flex items-center gap-1 mt-3 text-[10px] text-muted-foreground/60">
                      <Clock className="w-3 h-3" />
                      {(result.executionMs / 1000).toFixed(1)}s
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Pilares Revolucionários e Monitoramento */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up">
          <div className="lg:col-span-2 space-y-6">
            <MonitoringPanel tenantCatalog={session.targetCatalog} />
            <FinOpsAIPanel />
            <SelfHealingPanel schema="default" tableName="customers" />
            <FinOpsPanel />
          </div>
          <div className="lg:col-span-1">
            <CopilotChat host={session.databricksHost} catalog={session.targetCatalog} />
          </div>
        </div>

        {/* Lineage Graph */}
        {lineageData && (
          <div className="bg-card border border-border rounded-2xl p-6 animate-fade-in-up" style={{ animationDelay: "160ms" }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-gold" />
                <h3 className="font-display font-bold text-foreground">Linhagem de Dados</h3>
                {lineageData.summary?.totalEdges > 0 && (
                  <Badge variant="outline" className="text-gold border-gold/30 bg-gold-subtle text-xs ml-1">
                    {lineageData.summary.totalEdges} relações
                  </Badge>
                )}
              </div>
              {lineageData.summary?.totalEdges > 0 && (
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{lineageData.summary.uniqueSources ?? 0} origens</span>
                  <span>·</span>
                  <span>{lineageData.summary.uniqueTargets ?? 0} destinos</span>
                </div>
              )}
            </div>
            <LineageGraph
              data={((lineageData.lineageEdges ?? []) as any[]).map((e: any) => ({ sourceName: e.source, targetName: e.target, type: e.label ?? "direto" }))}
            />
          </div>
        )}

        {/* Score Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-up" style={{ animationDelay: "180ms" }}>
          {/* Gaps */}
          {uniqueGaps.length > 0 && (
            <div className="bg-card border border-destructive/20 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-warning" />
                <h3 className="font-display font-bold text-foreground">Gaps Identificados</h3>
                <Badge variant="outline" className="text-warning border-warning/30 text-xs ml-auto">{uniqueGaps.length}</Badge>
              </div>
              <ul className="space-y-2.5">
                {uniqueGaps.map((gap, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-warning mt-1.5 flex-shrink-0" />
                    {gap}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {uniqueRecs.length > 0 && (
            <div className="bg-card border border-success/20 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-success" />
                <h3 className="font-display font-bold text-foreground">Recomendações</h3>
                <Badge variant="outline" className="text-success border-success/30 text-xs ml-auto">{uniqueRecs.length}</Badge>
              </div>
              <ul className="space-y-2.5">
                {uniqueRecs.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <ArrowRight className="w-3.5 h-3.5 text-success mt-0.5 flex-shrink-0" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Best Practices Checklist */}
        <div className="bg-card border border-border rounded-2xl p-6 animate-fade-in-up" style={{ animationDelay: "240ms" }}>
          <div className="flex items-center gap-2 mb-5">
            <Shield className="w-5 h-5 text-gold" />
            <h3 className="font-display font-bold text-foreground">Comparação com Melhores Práticas</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                label: "Documentação de Ativos",
                desc: "≥80% tabelas e ≥60% colunas documentadas",
                ok: (glossaryData?.summary?.tableDocCoverage ?? 0) >= 80,
                value: `${glossaryData?.summary?.tableDocCoverage ?? 0}%`,
              },
              {
                label: "Classificação por Tags",
                desc: "≥50% dos ativos com tags aplicadas",
                ok: (session.tagCoverage ?? 0) >= 50,
                value: `${Math.round(session.tagCoverage ?? 0)}%`,
              },
              {
                label: "Políticas de Acesso",
                desc: "Grants configurados no catálogo",
                ok: (accessData?.summary?.totalGrants ?? 0) > 0,
                value: `${accessData?.summary?.totalGrants ?? 0} grants`,
              },
              {
                label: "Linhagem Rastreável",
                desc: "Relações de linhagem registradas",
                ok: (lineageData?.summary?.totalEdges ?? 0) > 0,
                value: `${lineageData?.summary?.totalEdges ?? 0} relações`,
              },
              {
                label: "Segurança Dinâmica",
                desc: "Funções de mascaramento ou filtros de linha",
                ok: (securityData?.summary?.totalFunctions ?? 0) > 0,
                value: `${securityData?.summary?.totalFunctions ?? 0} funções`,
              },
              {
                label: "Dados Sensíveis Marcados",
                desc: "Tags PII/LGPD aplicadas em ativos sensíveis",
                ok: (tagsData?.summary?.sensitiveDataTagged ?? 0) > 0,
                value: `${tagsData?.summary?.sensitiveDataTagged ?? 0} ativos`,
              },
            ].map(({ label, desc, ok, value }) => (
              <div key={label} className="flex items-start gap-3 p-4 rounded-xl bg-muted/20 border border-border">
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5", ok ? "bg-success/15" : "bg-destructive/15")}>
                  {ok ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <XCircle className="w-3.5 h-3.5 text-destructive" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    <span className={cn("text-xs font-mono font-semibold", ok ? "text-success" : "text-destructive")}>{value}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Grants Distribution Chart */}
        {accessData?.privilegeDistribution && accessData.privilegeDistribution.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-6 animate-fade-in-up" style={{ animationDelay: "270ms" }}>
            <div className="flex items-center gap-2 mb-5">
              <BarChart3 className="w-5 h-5 text-gold" />
              <h3 className="font-display font-bold text-foreground">Distribuição de Acessos por Tipo de Grant</h3>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={accessData.privilegeDistribution} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                  labelStyle={{ color: 'var(--foreground)', fontWeight: 600 }}
                  itemStyle={{ color: 'var(--gold)' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {accessData.privilegeDistribution.map((_: any, index: number) => (
                    <Cell key={index} fill={index % 2 === 0 ? 'var(--gold)' : 'var(--gold-dim)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Export CTA */}
        <div className="flex justify-center pb-4 animate-fade-in-up" style={{ animationDelay: "300ms" }}>
          <Button asChild size="lg" className="gradient-gold text-white font-semibold px-10 h-12 rounded-xl shadow-lg hover:shadow-gold/30 transition-shadow">
            <Link href={`/report/${sessionId}`}>
              <Download className="w-4 h-4 mr-2" />
              Exportar Relatório Completo
            </Link>
          </Button>
        </div>
      </div>
  );
}
