import VCLayout from "@/components/VCLayout";
import { DataLineageGraph as LineageGraph } from "@/components/DataLineageGraph";
import { trpc } from "@/lib/trpc";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download, FileJson, FileSpreadsheet, ArrowLeft,
  CheckCircle2, XCircle, Shield, Database, FileText,
  Tag, Lock, GitBranch, Eye, Clock
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ANALYSIS_META = [
  { type: "structure", label: "Mapeamento de Estrutura", icon: Database },
  { type: "glossary", label: "Glossário de Dados", icon: FileText },
  { type: "tags", label: "Classificação por Tags", icon: Tag },
  { type: "access", label: "Políticas de Acesso", icon: Lock },
  { type: "lineage", label: "Linhagem de Dados", icon: GitBranch },
  { type: "security", label: "Segurança Dinâmica", icon: Eye },
];

function flattenToRows(data: any, prefix = ""): Record<string, string>[] {
  if (!data) return [];
  const allRows: Record<string, string>[] = [];
  const keys = Object.keys(data);
  for (const key of keys) {
    if (Array.isArray(data[key]) && data[key].length > 0 && typeof data[key][0] === "object") {
      const sectionRows = data[key].map((row: any) => {
        const flat: Record<string, string> = { dataset: key };
        Object.entries(row).forEach(([k, v]) => {
          flat[`${prefix}${k}`] = v == null ? "" : String(v);
        });
        return flat;
      });
      allRows.push(...sectionRows);
    }
  }
  return allRows;
}

function toCSV(rows: Record<string, string>[]): string {
  if (rows.length === 0) return "Sem dados disponíveis\n";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((h) => `"${(row[h] ?? "").replace(/"/g, '""')}"`).join(",")
    ),
  ];
  return lines.join("\n");
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Report() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = parseInt(params.sessionId ?? "0");

  const { data, isLoading, error } = trpc.auditoria.databricks.exportReport.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );

  const handleDownloadJSON = () => {
    if (!data) return;
    const json = JSON.stringify(data, null, 2);
    downloadFile(json, `databricks-governance-report-${sessionId}.json`, "application/json");
    toast.success("Relatório JSON exportado com sucesso!");
  };

  const handleDownloadCSV = (analysisType?: string) => {
    if (!data) return;
    const analyses = analysisType
      ? data.analyses.filter((a) => a.type === analysisType)
      : data.analyses;

    const allRows: Record<string, string>[] = [];
    analyses.forEach((a) => {
      const rows = flattenToRows(a.data, "");
      rows.forEach((row) => {
        allRows.push({ analysis: a.type, ...row });
      });
    });

    const csv = toCSV(allRows);
    const name = analysisType
      ? `databricks-${analysisType}-${sessionId}.csv`
      : `databricks-governance-full-${sessionId}.csv`;
    downloadFile(csv, name, "text/csv;charset=utf-8;");
    toast.success("CSV exportado com sucesso!");
  };

  if (isLoading) {
    return (
      <VCLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
            <p className="text-muted-foreground">Preparando relatório...</p>
          </div>
        </div>
      </VCLayout>
    );
  }

  if (error || !data) {
    return (
      <VCLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <XCircle className="w-12 h-12 text-destructive mx-auto" />
            <p className="text-foreground font-semibold">Relatório não disponível</p>
            <Button asChild variant="outline"><Link href="/history">Ver Histórico</Link></Button>
          </div>
        </div>
      </VCLayout>
    );
  }

  const score = Math.round(data.metadata.governanceScore ?? 0);

  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Header */}
        <div className="flex items-start justify-between animate-fade-in-up">
          <div>
            <Button asChild variant="ghost" size="sm" className="mb-3 text-muted-foreground hover:text-foreground -ml-2">
              <Link href={`/dashboard/${sessionId}`}>
                <ArrowLeft className="w-4 h-4 mr-1.5" />Voltar ao Dashboard
              </Link>
            </Button>
            <h1 className="font-display text-3xl font-bold text-foreground">Exportar Relatório</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Catálogo: <span className="text-gold font-mono">{data.metadata.targetCatalog}</span> ·
              Auditado em {new Date(data.metadata.auditDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button onClick={handleDownloadJSON} className="gradient-gold text-white font-semibold h-10">
              <FileJson className="w-4 h-4 mr-2" />Exportar JSON
            </Button>
            <Button onClick={() => handleDownloadCSV()} variant="outline" className="border-border hover:border-gold/40 h-10">
              <FileSpreadsheet className="w-4 h-4 mr-2" />Exportar CSV Completo
            </Button>
            <Button
              variant="outline"
              className="border-gold/40 text-gold hover:bg-gold/10 hover:border-gold h-10"
              onClick={() => {
                const a = document.createElement("a");
                a.href = `/api/report/${sessionId}/pdf`;
                a.download = `governance_report_${data.metadata.targetCatalog}_${new Date(data.metadata.auditDate).toISOString().slice(0, 10)}.pdf`;
                a.click();
              }}
            >
              <FileText className="w-4 h-4 mr-2" />Baixar PDF Executivo
            </Button>
          </div>
        </div>

        {/* Summary Card */}
        <div className="bg-card border border-border rounded-2xl p-6 animate-fade-in-up" style={{ animationDelay: "60ms" }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl gradient-gold flex items-center justify-center shadow-lg">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-display font-bold text-foreground">Resumo Executivo</h2>
              <p className="text-xs text-muted-foreground">{data.metadata.databricksHost}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="font-display text-3xl font-bold text-gold">{score}</p>
              <p className="text-xs text-muted-foreground">Score de Governança</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Catálogos", value: data.summary.totalCatalogs ?? 0 },
              { label: "Schemas", value: data.summary.totalSchemas ?? 0 },
              { label: "Tabelas/Views", value: data.summary.totalTables ?? 0 },
              { label: "Documentação", value: `${Math.round(data.summary.docCoverage ?? 0)}%` },
              { label: "Tags", value: `${Math.round(data.summary.tagCoverage ?? 0)}%` },
            ].map(({ label, value }) => (
              <div key={label} className="text-center p-3 rounded-xl bg-muted/20 border border-border">
                <p className="font-display text-xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Per-Analysis Tabs */}
        <div className="animate-fade-in-up" style={{ animationDelay: "120ms" }}>
          <Tabs defaultValue="all">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-bold text-foreground">Dados por Análise</h2>
              <TabsList className="bg-muted/30 border border-border">
                <TabsTrigger value="all" className="text-xs">Todas</TabsTrigger>
                {ANALYSIS_META.map(({ type, label }) => (
                  <TabsTrigger key={type} value={type} className="text-xs hidden md:flex">{label.split(" ")[0]}</TabsTrigger>
                ))}
              </TabsList>
            </div>

            <TabsContent value="all">
              <div className="space-y-4">
                {data.analyses.map((analysis) => {
                  const meta = ANALYSIS_META.find((m) => m.type === analysis.type);
                  if (!meta) return null;
                  const Icon = meta.icon;
                  const rows = flattenToRows(analysis.data);
                  return (
                    <AnalysisCard
                      key={analysis.type}
                      icon={Icon}
                      label={meta.label}
                      analysis={analysis}
                      rows={rows}
                      onDownloadCSV={() => handleDownloadCSV(analysis.type)}
                    />
                  );
                })}
              </div>
            </TabsContent>

            {ANALYSIS_META.map(({ type, label, icon: Icon }) => {
              const analysis = data.analyses.find((a) => a.type === type);
              if (!analysis) return null;
              const rows = flattenToRows(analysis.data);
              const isLineage = type === "lineage";
              const lineageEdges = isLineage
                ? (((analysis.data as any)?.lineageEdges ?? []) as LineageEdge[])
                : [];
              return (
                <TabsContent key={type} value={type}>
                  <AnalysisCard
                    icon={Icon}
                    label={label}
                    analysis={analysis}
                    rows={rows}
                    onDownloadCSV={() => handleDownloadCSV(type)}
                  />
                  {isLineage && (
                    <div className="mt-4 bg-card border border-border rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <GitBranch className="w-4 h-4 text-gold" />
                        <h3 className="font-semibold text-foreground text-sm">Visualização do Grafo de Linhagem</h3>
                        {lineageEdges.length > 0 && (
                          <Badge variant="outline" className="text-gold border-gold/30 bg-gold-subtle text-[10px] ml-1">
                            {lineageEdges.length} relações
                          </Badge>
                        )}
                      </div>
                      <LineageGraph data={lineageEdges.map((e: any) => ({ sourceName: e.source, targetName: e.target, type: e.label ?? "direto" }))} />
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      </div>
  );
}

function AnalysisCard({ icon: Icon, label, analysis, rows, onDownloadCSV }: {
  icon: any;
  label: string;
  analysis: any;
  rows: Record<string, string>[];
  onDownloadCSV: () => void;
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gold-subtle flex items-center justify-center">
            <Icon className="w-4 h-4 text-gold" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">{label}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className={cn("text-[10px]", analysis.status === "completed" ? "text-success border-success/30" : "text-destructive border-destructive/30")}>
                {analysis.status === "completed" ? "Concluída" : "Falhou"}
              </Badge>
              {analysis.executionMs && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />{(analysis.executionMs / 1000).toFixed(1)}s
                </span>
              )}
              <span className="text-[10px] text-muted-foreground">{rows.length} registros</span>
            </div>
          </div>
        </div>
        <Button onClick={onDownloadCSV} variant="outline" size="sm" className="text-xs border-border hover:border-gold/40 h-8">
          <Download className="w-3 h-3 mr-1.5" />CSV
        </Button>
      </div>

      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/20 border-b border-border">
                {Object.keys(rows[0]).map((col) => (
                  <th key={col} className="px-4 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 50).map((row, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                  {Object.values(row).map((val, j) => (
                    <td key={j} className="px-4 py-2.5 text-muted-foreground font-mono whitespace-nowrap max-w-xs truncate">
                      {val || <span className="text-muted-foreground/40 italic">null</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 50 && (
            <p className="text-xs text-muted-foreground text-center py-3 border-t border-border">
              Exibindo 50 de {rows.length} registros · Exporte o CSV para ver todos
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
          {analysis.status === "failed" ? (
            <div className="text-center">
              <XCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
              <p>{analysis.errorMessage ?? "Análise falhou"}</p>
            </div>
          ) : (
            <div className="text-center">
              <CheckCircle2 className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p>Nenhum dado retornado para esta análise</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
