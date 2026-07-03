import VCLayout from "@/components/VCLayout";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield, Plus, ArrowRight, Clock, Database,
  TrendingUp, TrendingDown, Minus, BarChart3, Filter,
  GitCompare, X, CheckCircle2, XCircle, ChevronUp, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useMemo, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Session = {
  id: number;
  databricksHost: string;
  targetCatalog: string;
  status: string;
  governanceScore: number | null;
  totalCatalogs: number | null;
  totalSchemas: number | null;
  totalTables: number | null;
  docCoverage: number | null;
  tagCoverage: number | null;
  createdAt: Date | string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#f59e0b";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Excelente";
  if (score >= 60) return "Bom";
  if (score >= 40) return "Regular";
  return "Crítico";
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted-foreground text-xs">—</span>;
  const s = Math.round(score);
  const color =
    s >= 80 ? "text-success border-success/30 bg-success/10"
    : s >= 60 ? "text-warning border-warning/30 bg-warning/10"
    : s >= 40 ? "text-orange-400 border-orange-400/30 bg-orange-400/10"
    : "text-destructive border-destructive/30 bg-destructive/10";
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-bold font-mono", color)}>
      {s}
    </span>
  );
}

function DeltaBadge({ a, b }: { a: number | null; b: number | null }) {
  if (a == null || b == null) return <span className="text-muted-foreground text-xs">—</span>;
  const delta = Math.round(a - b);
  if (delta > 0) return (
    <span className="inline-flex items-center gap-0.5 text-success text-xs font-semibold">
      <ChevronUp className="w-3 h-3" />+{delta}
    </span>
  );
  if (delta < 0) return (
    <span className="inline-flex items-center gap-0.5 text-destructive text-xs font-semibold">
      <ChevronDown className="w-3 h-3" />{delta}
    </span>
  );
  return <span className="text-muted-foreground text-xs font-semibold">= 0</span>;
}

function TrendIndicator({ current, previous }: { current: number; previous: number | null }) {
  if (previous == null) return null;
  const delta = current - previous;
  if (delta > 0) return (
    <span className="flex items-center gap-0.5 text-success text-[10px] font-semibold">
      <TrendingUp className="w-3 h-3" />+{delta}
    </span>
  );
  if (delta < 0) return (
    <span className="flex items-center gap-0.5 text-destructive text-[10px] font-semibold">
      <TrendingDown className="w-3 h-3" />{delta}
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-muted-foreground text-[10px]">
      <Minus className="w-3 h-3" />0
    </span>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  const score = entry?.value as number;
  const catalog = entry?.payload?.catalog as string;
  const host = entry?.payload?.host as string;
  return (
    <div className="bg-card border border-border rounded-xl shadow-xl p-4 min-w-[200px]">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="font-mono text-gold text-xs mb-1 truncate">{catalog}</p>
      {host && <p className="text-[10px] text-muted-foreground mb-2 truncate">{host}</p>}
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold font-display" style={{ color: scoreColor(score) }}>{score}</span>
        <span className="text-muted-foreground text-sm">/ 100</span>
      </div>
      <p className="text-xs mt-1" style={{ color: scoreColor(score) }}>{scoreLabel(score)}</p>
    </div>
  );
}

function CustomDot(props: any) {
  const { cx, cy, payload } = props;
  const score = payload?.score ?? 0;
  return (
    <circle cx={cx} cy={cy} r={5} fill={scoreColor(score)}
      stroke="hsl(var(--background))" strokeWidth={2} />
  );
}

// ─── Catalog Selector ─────────────────────────────────────────────────────────

function CatalogSelector({ catalogs, selected, onChange }: {
  catalogs: string[]; selected: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
        <Filter className="w-3.5 h-3.5" />Catálogo:
      </span>
      <button onClick={() => onChange("__all__")}
        className={cn("px-3 py-1 rounded-full text-xs font-semibold border transition-all",
          selected === "__all__"
            ? "bg-gold text-white border-gold shadow-sm"
            : "bg-transparent text-muted-foreground border-border hover:border-gold/40 hover:text-foreground"
        )}>
        Todos
      </button>
      {catalogs.map((cat) => (
        <button key={cat} onClick={() => onChange(cat)}
          className={cn("px-3 py-1 rounded-full text-xs font-mono font-semibold border transition-all",
            selected === cat
              ? "bg-gold text-white border-gold shadow-sm"
              : "bg-transparent text-muted-foreground border-border hover:border-gold/40 hover:text-foreground"
          )}>
          {cat}
        </button>
      ))}
    </div>
  );
}

// ─── Comparison Table ─────────────────────────────────────────────────────────

function ComparisonTable({ sessionIdA, sessionIdB, onClose }: {
  sessionIdA: number; sessionIdB: number; onClose: () => void;
}) {
  const { data, isLoading } = trpc.databricks.compareSessions.useQuery(
    { sessionIdA, sessionIdB },
    { enabled: true }
  );

  if (isLoading || !data) {
    return (
      <div className="bg-card border border-gold/20 rounded-2xl shadow-2xl p-10 flex items-center justify-center animate-fade-in-up">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando comparação...</p>
        </div>
      </div>
    );
  }

  // Ensure A is the more recent session
  const [a, b, clA, clB] =
    new Date(data.sessionA.createdAt) >= new Date(data.sessionB.createdAt)
      ? [data.sessionA, data.sessionB, data.checklistA, data.checklistB]
      : [data.sessionB, data.sessionA, data.checklistB, data.checklistA];

  const rows: {
    label: string;
    category: string;
    valA: number | null;
    valB: number | null;
    unit?: string;
    higherIsBetter?: boolean;
    isScore?: boolean;
  }[] = [
    { label: "Score de Governança", category: "Geral", valA: a.governanceScore, valB: b.governanceScore, higherIsBetter: true, isScore: true },
    { label: "Total de Catálogos", category: "Estrutura", valA: a.totalCatalogs, valB: b.totalCatalogs, higherIsBetter: true },
    { label: "Total de Schemas", category: "Estrutura", valA: a.totalSchemas, valB: b.totalSchemas, higherIsBetter: true },
    { label: "Total de Tabelas/Views", category: "Estrutura", valA: a.totalTables, valB: b.totalTables, higherIsBetter: true },
    { label: "Cobertura de Documentação", category: "Glossário", valA: a.docCoverage, valB: b.docCoverage, unit: "%", higherIsBetter: true },
    { label: "Cobertura de Tags", category: "Classificação", valA: a.tagCoverage, valB: b.tagCoverage, unit: "%", higherIsBetter: true },
    { label: "Total de Grants", category: "Políticas de Acesso", valA: a.grantsCount ?? null, valB: b.grantsCount ?? null, higherIsBetter: true },
  ];

  const categories = Array.from(new Set(rows.map((r) => r.category)));

  const formatVal = (val: number | null, unit?: string, isScore?: boolean) => {
    if (val == null) return "—";
    const v = isScore ? Math.round(val) : (unit === "%" ? val.toFixed(1) : val);
    return unit ? `${v}${unit}` : `${v}`;
  };

  const getWinner = (valA: number | null, valB: number | null, higherIsBetter = true) => {
    if (valA == null || valB == null) return null;
    if (valA === valB) return "tie";
    return (higherIsBetter ? valA > valB : valA < valB) ? "a" : "b";
  };

  // Build unified checklist merging both sessions
  const allTypes = ["structure", "glossary", "tags", "access", "lineage", "security"];
  const clMapA = Object.fromEntries(clA.map((c) => [c.type, c]));
  const clMapB = Object.fromEntries(clB.map((c) => [c.type, c]));

  return (
    <div className="bg-card border border-gold/20 rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gold-subtle">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl gradient-gold flex items-center justify-center shadow-md">
            <GitCompare className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-foreground">Comparação de Auditorias</h2>
            <p className="text-xs text-muted-foreground">Análise comparativa detalhada entre dois momentos</p>
          </div>
        </div>
        <button onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Session column headers */}
      <div className="grid grid-cols-[1fr_1fr_1fr] border-b border-border">
        <div className="px-6 py-4 border-r border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Métrica</p>
        </div>
        {[a, b].map((s, idx) => (
          <div key={s.id} className={cn("px-6 py-4", idx === 0 && "border-r border-border bg-gold/5")}>
            <div className="flex items-center gap-2 mb-1">
              <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0",
                idx === 0 ? "bg-gold" : "bg-muted-foreground")}>
                {idx === 0 ? "A" : "B"}
              </span>
              <span className="text-xs font-semibold text-foreground">{idx === 0 ? "Mais Recente" : "Anterior"}</span>
            </div>
            <p className="font-mono text-xs text-gold truncate">{s.targetCatalog}</p>
            <p className="text-[10px] text-muted-foreground truncate">{s.databricksHost}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {new Date(s.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
          </div>
        ))}
      </div>

      {/* KPI rows grouped by category */}
      {categories.map((cat) => (
        <div key={cat}>
          <div className="px-6 py-2 bg-muted/20 border-b border-border">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{cat}</p>
          </div>
          {rows.filter((r) => r.category === cat).map((row, ri) => {
            const winner = getWinner(row.valA, row.valB, row.higherIsBetter);
            return (
              <div key={ri} className="grid grid-cols-[1fr_1fr_1fr] border-b border-border last:border-b-0 hover:bg-muted/10 transition-colors">
                <div className="px-6 py-3.5 border-r border-border flex items-center">
                  <p className="text-sm text-foreground font-medium">{row.label}</p>
                </div>
                {([{ val: row.valA, side: "a" }, { val: row.valB, side: "b" }] as const).map(({ val, side }, idx) => {
                  const isWinner = winner === side;
                  const isTie = winner === "tie";
                  return (
                    <div key={side} className={cn(
                      "px-6 py-3.5 flex items-center justify-between gap-3",
                      idx === 0 && "border-r border-border bg-gold/5",
                      isWinner && "bg-success/5",
                    )}>
                      <div className="flex items-center gap-2">
                        {row.isScore && val != null ? (
                          <span className="font-display text-xl font-bold" style={{ color: scoreColor(val) }}>
                            {Math.round(val)}
                          </span>
                        ) : (
                          <span className={cn("font-mono text-sm font-semibold",
                            isWinner ? "text-success" : isTie ? "text-foreground" : "text-muted-foreground")}>
                            {formatVal(val, row.unit)}
                          </span>
                        )}
                        {row.isScore && val != null && <span className="text-xs text-muted-foreground">/ 100</span>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isWinner && <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />}
                        {!isWinner && !isTie && val != null && <XCircle className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />}
                        {idx === 0 && <DeltaBadge a={row.valA} b={row.valB} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ))}

      {/* Checklist comparison */}
      <div>
        <div className="px-6 py-2 bg-muted/20 border-b border-border">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Checklist de Análises</p>
        </div>
        {allTypes.map((type) => {
          const entryA = clMapA[type];
          const entryB = clMapB[type];
          const label = entryA?.label ?? entryB?.label ?? type;
          const okA = entryA?.status === "completed";
          const okB = entryB?.status === "completed";
          return (
            <div key={type} className="grid grid-cols-[1fr_1fr_1fr] border-b border-border last:border-b-0 hover:bg-muted/10 transition-colors">
              <div className="px-6 py-3 border-r border-border flex items-center">
                <p className="text-sm text-foreground font-medium">{label}</p>
              </div>
              {[{ ok: okA, entry: entryA }, { ok: okB, entry: entryB }].map(({ ok, entry }, idx) => (
                <div key={idx} className={cn(
                  "px-6 py-3 flex items-center justify-between gap-3",
                  idx === 0 && "border-r border-border bg-gold/5"
                )}>
                  <div className="flex items-center gap-2">
                    {ok
                      ? <CheckCircle2 className="w-4 h-4 text-success" />
                      : <XCircle className="w-4 h-4 text-destructive" />}
                    <span className={cn("text-xs font-semibold", ok ? "text-success" : "text-destructive")}>
                      {ok ? "Concluída" : entry?.status === "failed" ? "Falhou" : "Não executada"}
                    </span>
                  </div>
                  {entry?.score != null && (
                    <span className="font-mono text-xs text-muted-foreground">{Math.round(entry.score)}pts</span>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-muted/10 border-t border-border">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span>A = auditoria mais recente · B = auditoria anterior</span>
          </div>
          <div className="flex items-center gap-4">
            {a.governanceScore != null && b.governanceScore != null && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Variação do score:</span>
                <DeltaBadge a={a.governanceScore} b={b.governanceScore} />
              </div>
            )}
            <Button size="sm" variant="outline" onClick={onClose}
              className="border-border hover:border-gold/40 h-8 text-xs">Fechar comparação</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function History() {
  const { data: sessions, isLoading } = trpc.databricks.listSessions.useQuery();
  const [selectedCatalog, setSelectedCatalog] = useState<string>("__all__");
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showComparison, setShowComparison] = useState(false);

  // All unique catalogs from completed sessions
  const catalogs = useMemo(() => {
    if (!sessions) return [];
    const arr = sessions
      .filter((s) => s.status === "completed" && s.governanceScore != null)
      .map((s) => s.targetCatalog)
      .filter(Boolean) as string[];
    return Array.from(new Set(arr)).sort();
  }, [sessions]);

  // Chart data filtered by selected catalog
  const chartData = useMemo(() => {
    if (!sessions) return [];
    return sessions
      .filter((s) => {
        if (s.status !== "completed" || s.governanceScore == null) return false;
        if (selectedCatalog !== "__all__" && s.targetCatalog !== selectedCatalog) return false;
        return true;
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((s) => ({
        date: new Date(s.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
        score: Math.round(s.governanceScore!),
        catalog: s.targetCatalog,
        host: s.databricksHost,
        id: s.id,
      }));
  }, [sessions, selectedCatalog]);

  const hasChart = chartData.length >= 2;
  const latestScore = chartData.length > 0 ? chartData[chartData.length - 1]?.score ?? null : null;
  const prevScore = chartData.length > 1 ? chartData[chartData.length - 2]?.score ?? null : null;
  const avgScore = chartData.length > 0
    ? Math.round(chartData.reduce((acc, d) => acc + d.score, 0) / chartData.length) : null;
  const maxScore = chartData.length > 0 ? Math.max(...chartData.map((d) => d.score)) : null;

  // Filtered session list
  const filteredSessions = useMemo(() => {
    if (!sessions) return [];
    if (selectedCatalog === "__all__") return sessions;
    return sessions.filter((s) => s.targetCatalog === selectedCatalog);
  }, [sessions, selectedCatalog]);

  // Completed sessions eligible for comparison
  const completedSessions = useMemo(() =>
    (sessions ?? []).filter((s) => s.status === "completed" && s.governanceScore != null),
    [sessions]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1]!, id]; // replace oldest selection
      return [...prev, id];
    });
  };

  const sessionMap = useMemo(() => {
    const m: Record<number, Session> = {};
    (sessions ?? []).forEach((s) => { m[s.id] = s as Session; });
    return m;
  }, [sessions]);

  const handleCompare = () => {
    if (selectedIds.length === 2) setShowComparison(true);
  };

  const handleCloseComparison = () => {
    setShowComparison(false);
    setSelectedIds([]);
    setCompareMode(false);
  };

  return (
    <VCLayout>
      <div className="min-h-screen p-8 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between animate-fade-in-up flex-wrap gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Histórico de Auditorias</h1>
            <p className="text-muted-foreground mt-1 text-sm">Evolução do score de governança ao longo do tempo</p>
          </div>
          <div className="flex items-center gap-3">
            {completedSessions.length >= 2 && !compareMode && (
              <Button variant="outline" onClick={() => { setCompareMode(true); setShowComparison(false); setSelectedIds([]); }}
                className="border-border hover:border-gold/40 h-10 text-sm gap-2">
                <GitCompare className="w-4 h-4" />Comparar Auditorias
              </Button>
            )}
            {compareMode && (
              <Button variant="outline" onClick={() => { setCompareMode(false); setSelectedIds([]); setShowComparison(false); }}
                className="border-border hover:border-gold/40 h-10 text-sm gap-2 text-muted-foreground">
                <X className="w-4 h-4" />Cancelar
              </Button>
            )}
            <Button asChild className="gradient-gold text-white font-semibold h-10">
              <Link href="/connect"><Plus className="w-4 h-4 mr-2" />Nova Auditoria</Link>
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : !sessions || sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 animate-fade-in-up">
            <div className="w-16 h-16 rounded-2xl gradient-gold flex items-center justify-center mb-5 shadow-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h2 className="font-display text-xl font-bold text-foreground mb-2">Nenhuma auditoria encontrada</h2>
            <p className="text-muted-foreground text-sm mb-6 text-center max-w-sm">
              Inicie sua primeira auditoria de governança conectando ao seu ambiente Databricks.
            </p>
            <Button asChild className="gradient-gold text-white font-semibold">
              <Link href="/connect">Iniciar Primeira Auditoria</Link>
            </Button>
          </div>
        ) : (
          <>
            {/* ── Compare mode banner ─────────────────────────────────────── */}
            {compareMode && (
              <div className={cn(
                "flex items-center justify-between px-5 py-3.5 rounded-xl border animate-fade-in-up",
                selectedIds.length === 2
                  ? "bg-gold/10 border-gold/30"
                  : "bg-muted/30 border-border"
              )}>
                <div className="flex items-center gap-3">
                  <GitCompare className={cn("w-5 h-5", selectedIds.length === 2 ? "text-gold" : "text-muted-foreground")} />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {selectedIds.length === 0 && "Selecione 2 auditorias concluídas para comparar"}
                      {selectedIds.length === 1 && "Selecione mais 1 auditoria"}
                      {selectedIds.length === 2 && "2 auditorias selecionadas — pronto para comparar"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Apenas auditorias com status "Concluída" podem ser comparadas
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleCompare}
                  disabled={selectedIds.length !== 2}
                  className={cn("h-9 text-sm font-semibold gap-2",
                    selectedIds.length === 2
                      ? "gradient-gold text-white"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}>
                  <GitCompare className="w-4 h-4" />Ver Comparação
                </Button>
              </div>
            )}

            {/* ── Comparison Table ────────────────────────────────────────── */}
            {showComparison && selectedIds.length === 2 && (
              <ComparisonTable
                sessionIdA={selectedIds[0]!}
                sessionIdB={selectedIds[1]!}
                onClose={handleCloseComparison}
              />
            )}

            {/* ── Score Evolution Chart ───────────────────────────────────── */}
            {!compareMode && (
              <div className="bg-card border border-border rounded-2xl p-6 shadow-lg animate-fade-in-up" style={{ animationDelay: "40ms" }}>
                <div className="flex items-start justify-between mb-5 flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl gradient-gold flex items-center justify-center shadow-md flex-shrink-0">
                      <BarChart3 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="font-display text-lg font-bold text-foreground">Evolução do Score de Governança</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {chartData.length} auditoria{chartData.length !== 1 ? "s" : ""} concluída{chartData.length !== 1 ? "s" : ""}
                        {selectedCatalog !== "__all__" && (
                          <> · catálogo <span className="font-mono text-gold">{selectedCatalog}</span></>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="hidden md:flex items-center gap-6">
                    {latestScore != null && (
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Último Score</p>
                        <div className="flex items-center gap-1.5">
                          <span className="font-display text-2xl font-bold" style={{ color: scoreColor(latestScore) }}>{latestScore}</span>
                          <TrendIndicator current={latestScore} previous={prevScore} />
                        </div>
                      </div>
                    )}
                    {avgScore != null && (
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Média</p>
                        <span className="font-display text-2xl font-bold text-foreground">{avgScore}</span>
                      </div>
                    )}
                    {maxScore != null && (
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Máximo</p>
                        <span className="font-display text-2xl font-bold text-success">{maxScore}</span>
                      </div>
                    )}
                  </div>
                </div>

                {catalogs.length > 1 && (
                  <div className="mb-5 pb-5 border-b border-border">
                    <CatalogSelector catalogs={catalogs} selected={selectedCatalog} onChange={setSelectedCatalog} />
                  </div>
                )}

                {hasChart ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }} />
                        <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.4}
                          label={{ value: "Excelente", position: "insideTopRight", fill: "#22c55e", fontSize: 10 }} />
                        <ReferenceLine y={60} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.4}
                          label={{ value: "Bom", position: "insideTopRight", fill: "#f59e0b", fontSize: 10 }} />
                        <ReferenceLine y={40} stroke="#f97316" strokeDasharray="4 4" strokeOpacity={0.4}
                          label={{ value: "Regular", position: "insideTopRight", fill: "#f97316", fontSize: 10 }} />
                        <Line type="monotone" dataKey="score" stroke="#d4a017" strokeWidth={2.5}
                          dot={<CustomDot />}
                          activeDot={{ r: 7, fill: "#d4a017", stroke: "hsl(var(--background))", strokeWidth: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : chartData.length === 1 ? (
                  <div className="h-24 flex items-center justify-center rounded-xl bg-muted/30 border border-dashed border-border">
                    <p className="text-sm text-muted-foreground">Execute mais uma auditoria para visualizar a tendência</p>
                  </div>
                ) : (
                  <div className="h-24 flex items-center justify-center rounded-xl bg-muted/30 border border-dashed border-border">
                    <p className="text-sm text-muted-foreground">
                      {selectedCatalog !== "__all__"
                        ? `Nenhuma auditoria concluída para o catálogo "${selectedCatalog}"`
                        : "Nenhuma auditoria concluída ainda"}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border flex-wrap">
                  {[
                    { color: "#22c55e", label: "Excelente (≥ 80)" },
                    { color: "#f59e0b", label: "Bom (60–79)" },
                    { color: "#f97316", label: "Regular (40–59)" },
                    { color: "#ef4444", label: "Crítico (< 40)" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Session List ─────────────────────────────────────────────── */}
            <div className="space-y-3 animate-fade-in-up" style={{ animationDelay: "80ms" }}>
              <div className="flex items-center justify-between px-1">
                <h2 className="font-display text-lg font-semibold text-foreground">
                  {compareMode
                    ? `Selecione 2 auditorias (${selectedIds.length}/2)`
                    : selectedCatalog === "__all__" ? "Todas as Auditorias" : `Auditorias · ${selectedCatalog}`}
                </h2>
                {!compareMode && selectedCatalog !== "__all__" && (
                  <button onClick={() => setSelectedCatalog("__all__")}
                    className="text-xs text-muted-foreground hover:text-gold transition-colors underline underline-offset-2">
                    Limpar filtro
                  </button>
                )}
              </div>

              {filteredSessions.length === 0 ? (
                <div className="flex items-center justify-center py-10 rounded-xl border border-dashed border-border">
                  <p className="text-sm text-muted-foreground">Nenhuma auditoria encontrada para este catálogo.</p>
                </div>
              ) : (
                filteredSessions.map((session, i) => {
                  const isCompleted = session.status === "completed";
                  const isSelected = selectedIds.includes(session.id);
                  const isDisabledForCompare = compareMode && !isCompleted;

                  const completedBefore = (sessions ?? [])
                    .filter((s) =>
                      s.status === "completed" &&
                      s.governanceScore != null &&
                      s.targetCatalog === session.targetCatalog &&
                      new Date(s.createdAt) < new Date(session.createdAt)
                    )
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                  const prevSessionScore = completedBefore[0]?.governanceScore ?? null;

                  return (
                    <div
                      key={session.id}
                      onClick={() => compareMode && isCompleted && toggleSelect(session.id)}
                      className={cn(
                        "bg-card border rounded-xl p-5 transition-all animate-fade-in-up",
                        compareMode && isCompleted && "cursor-pointer",
                        isSelected && "border-gold/40 bg-gold/5 shadow-md",
                        !isSelected && isCompleted && compareMode && "hover:border-gold/20",
                        !isSelected && !compareMode && "hover:border-gold/20 border-border",
                        !isSelected && !compareMode && "border-border",
                        isDisabledForCompare && "opacity-40 cursor-not-allowed",
                      )}
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <div className="flex items-center gap-4">
                        {/* Compare checkbox */}
                        {compareMode && isCompleted && (
                          <div className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all",
                            isSelected ? "bg-gold border-gold" : "border-border bg-transparent"
                          )}>
                            {isSelected && (
                              <span className="text-white text-[10px] font-bold">
                                {selectedIds.indexOf(session.id) + 1}
                              </span>
                            )}
                          </div>
                        )}

                        <div className="w-10 h-10 rounded-xl bg-gold-subtle border border-gold/20 flex items-center justify-center flex-shrink-0">
                          <Database className="w-5 h-5 text-gold" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-semibold text-foreground text-sm truncate">{session.databricksHost}</p>
                            <Badge variant="outline" className={cn("text-[10px] flex-shrink-0",
                              session.status === "completed" ? "text-success border-success/30"
                              : session.status === "failed" ? "text-destructive border-destructive/30"
                              : "text-warning border-warning/30"
                            )}>
                              {session.status === "completed" ? "Concluída" : session.status === "failed" ? "Falhou" : "Executando"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            <button
                              onClick={(e) => { e.stopPropagation(); if (!compareMode) setSelectedCatalog(session.targetCatalog); }}
                              className={cn("font-mono transition-colors",
                                selectedCatalog === session.targetCatalog ? "text-gold font-semibold" : "text-gold/70 hover:text-gold"
                              )}>
                              {session.targetCatalog}
                            </button>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(session.createdAt).toLocaleDateString("pt-BR", {
                                day: "2-digit", month: "short", year: "numeric",
                                hour: "2-digit", minute: "2-digit"
                              })}
                            </span>
                            {session.totalTables != null && (
                              <><span>·</span><span>{session.totalTables} tabelas</span></>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-center hidden sm:block">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Score</p>
                            <div className="flex items-center gap-1.5 justify-center">
                              <ScoreBadge score={session.governanceScore} />
                              {isCompleted && session.governanceScore != null && (
                                <TrendIndicator
                                  current={Math.round(session.governanceScore)}
                                  previous={prevSessionScore != null ? Math.round(prevSessionScore) : null}
                                />
                              )}
                            </div>
                          </div>
                          {isCompleted && !compareMode && (
                            <Button asChild size="sm" variant="outline"
                              className="border-border hover:border-gold/40 h-8 text-xs">
                              <Link href={`/dashboard/${session.id}`}>
                                Ver Dashboard <ArrowRight className="w-3 h-3 ml-1.5" />
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </VCLayout>
  );
}
