import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell
} from "recharts";
import {
  TrendingUp, Database, Shield, Users, Star, BookOpen,
  CheckCircle2, AlertTriangle, XCircle, Award, Target,
  Layers, ChevronRight, FileText, UserX, Gauge, Clock
} from "lucide-react";
import { useState } from "react";

// ─── Maturity level helpers ───────────────────────────────────────────────────
function maturityLevel(score: number) {
  if (score >= 80) return { label: "Otimizado",     color: "bg-emerald-500", textColor: "text-emerald-700", icon: Award };
  if (score >= 60) return { label: "Gerenciado",    color: "bg-blue-500",    textColor: "text-blue-700",    icon: CheckCircle2 };
  if (score >= 40) return { label: "Definido",      color: "bg-yellow-500",  textColor: "text-yellow-700",  icon: TrendingUp };
  if (score >= 20) return { label: "Repetível",     color: "bg-orange-500",  textColor: "text-orange-700",  icon: AlertTriangle };
  return           { label: "Inicial",              color: "bg-red-500",     textColor: "text-red-700",     icon: XCircle };
}

// ─── Score card individual ────────────────────────────────────────────────────
function DimensionCard({ label, score, description, icon: Icon }: {
  label: string; score: number; description: string; icon: React.ElementType;
}) {
  const lvl = maturityLevel(score);
  const LevelIcon = lvl.icon;
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#1B3A8C]/10 rounded-lg">
              <Icon className="h-4 w-4 text-[#1B3A8C]" />
            </div>
            <span className="font-medium text-sm">{label}</span>
          </div>
          <div className="flex items-center gap-1">
            <LevelIcon className={`h-4 w-4 ${lvl.textColor}`} />
            <span className={`text-xs font-semibold ${lvl.textColor}`}>{lvl.label}</span>
          </div>
        </div>
        <div className="flex items-end gap-2 mb-2">
          <span className="text-3xl font-bold text-[#1B3A8C]">{score}</span>
          <span className="text-muted-foreground text-sm mb-1">/100</span>
        </div>
        <Progress value={score} className="h-2 mb-2" />
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

// ─── KPI statistic (clicável) ─────────────────────────────────────────────────
function StatBadge({ label, value, total, onClick }: {
  label: string; value: number; total: number; onClick?: () => void;
}) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  const missing = total - value;
  const hasIssues = missing > 0;
  return (
    <button
      onClick={onClick}
      className={`flex flex-col gap-1 p-3 border rounded-lg text-left w-full transition-all
        ${onClick ? "cursor-pointer hover:border-[#1B3A8C] hover:shadow-md hover:bg-blue-50/40" : "cursor-default"}
        ${hasIssues ? "border-orange-200 bg-orange-50/30" : "border-green-200 bg-green-50/20"}`}
    >
      <span className="text-xs text-muted-foreground flex items-center justify-between">
        {label}
        {onClick && hasIssues && <ChevronRight className="h-3 w-3 text-orange-400" />}
      </span>
      <span className="font-bold text-lg">
        {value}<span className="text-xs text-muted-foreground font-normal"> / {total}</span>
      </span>
      <Badge variant="outline" className={`w-fit text-xs ${hasIssues ? "border-orange-300 text-orange-700" : "border-green-300 text-green-700"}`}>
        {pct}%
      </Badge>
    </button>
  );
}

// ─── Tipos do drill-down ──────────────────────────────────────────────────────
type DrilldownKey = "allAssets" | "missingDesc" | "missingOwner" | "missingSteward" | "lowQuality" | "pendingAccess" | "pendingGlossary" | null;

const drilldownMeta: Record<Exclude<DrilldownKey, null>, { title: string; description: string; icon: React.ElementType; emptyMsg: string }> = {
  allAssets:       { title: "Todos os Ativos Globais",    description: "Visão completa de todos os ativos de dados catalogados.",                icon: Database, emptyMsg: "Nenhum ativo cadastrado ainda." },
  missingDesc:     { title: "Ativos sem Descrição",     description: "Ativos de dados que ainda não possuem descrição preenchida.", icon: FileText, emptyMsg: "Todos os ativos têm descrição!" },
  missingOwner:    { title: "Ativos sem Data Owner",    description: "Ativos de dados sem responsável (Data Owner) designado.",    icon: UserX,   emptyMsg: "Todos os ativos têm Data Owner!" },
  missingSteward:  { title: "Ativos sem Data Steward",  description: "Ativos de dados sem curador (Data Steward) designado.",      icon: UserX,   emptyMsg: "Todos os ativos têm Data Steward!" },
  lowQuality:      { title: "Ativos com Baixa Qualidade", description: "Ativos com score de qualidade abaixo de 70.",              icon: Gauge,   emptyMsg: "Todos os ativos têm alta qualidade!" },
  pendingAccess:   { title: "Solicitações de Acesso Pendentes", description: "Solicitações aguardando aprovação do Owner ou Steward.", icon: Clock, emptyMsg: "Nenhuma solicitação pendente!" },
  pendingGlossary: { title: "Termos não Aprovados",     description: "Termos do glossário que ainda não foram aprovados.",          icon: BookOpen, emptyMsg: "Todos os termos estão aprovados!" },
};

function typeLabel(type: string) {
  const map: Record<string, string> = { tabela: "Tabela", api: "API", arquivo: "Arquivo", dashboard: "Dashboard", outro: "Outro" };
  return map[type] ?? type;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MaturityDashboard() {
  const { data, isLoading } = trpc.maturity.score.useQuery();
  const { data: domainQuality } = trpc.maturity.domainQuality.useQuery();
  const { data: drilldown } = trpc.maturity.drilldown.useQuery();
  const [activeKey, setActiveKey] = useState<DrilldownKey>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B3A8C]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Dados insuficientes para calcular maturidade.
      </div>
    );
  }

  const overall = data.overall;
  const lvl = maturityLevel(overall);
  const OverallIcon = lvl.icon;

  const radarData = [
    { subject: "Descrição",   A: data.scores.descricao },
    { subject: "Governança",  A: data.scores.governanca },
    { subject: "Qualidade",   A: data.scores.qualidade },
    { subject: "Acessos",     A: data.scores.acessos },
    { subject: "Glossário",   A: data.scores.glossario },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-[#1B3A8C]/10 rounded-xl">
          <TrendingUp className="h-7 w-7 text-[#1B3A8C]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#1B3A8C]">Maturidade de Dados</h1>
          <p className="text-muted-foreground text-sm">Scorecard de governança baseado nos dados do catálogo</p>
        </div>
      </div>

      {/* Overall score */}
      <Card className="border-[#1B3A8C]/20 bg-gradient-to-r from-[#1B3A8C]/5 to-white">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* Big number */}
            <div className="flex flex-col items-center gap-2">
              <div className={`w-32 h-32 rounded-full ${lvl.color} flex items-center justify-center shadow-lg`}>
                <div className="text-center text-white">
                  <div className="text-4xl font-black">{overall}</div>
                  <div className="text-xs font-medium opacity-90">/ 100</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <OverallIcon className={`h-4 w-4 ${lvl.textColor}`} />
                <span className={`font-bold text-sm ${lvl.textColor}`}>{lvl.label}</span>
              </div>
            </div>

            {/* Radar */}
            <div className="flex-1 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                  <Radar dataKey="A" stroke="#1B3A8C" fill="#1B3A8C" fillOpacity={0.25} />
                  <Tooltip formatter={(v: number) => [`${v}/100`]} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Maturity scale */}
            <div className="space-y-2 min-w-[160px]">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Escala de Maturidade</p>
              {[
                { min: 80, label: "Otimizado",  color: "bg-emerald-500" },
                { min: 60, label: "Gerenciado", color: "bg-blue-500" },
                { min: 40, label: "Definido",   color: "bg-yellow-500" },
                { min: 20, label: "Repetível",  color: "bg-orange-500" },
                { min: 0,  label: "Inicial",    color: "bg-red-500" },
              ].map(lvl => (
                <div key={lvl.label} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${lvl.color}`} />
                  <span className="text-xs">{lvl.label} ({lvl.min}+)</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dimension cards */}
      <div>
        <h2 className="text-lg font-semibold text-[#1B3A8C] mb-4">Dimensões de Maturidade</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <DimensionCard
            label="Descrição"
            score={data.scores.descricao}
            description="Ativos com descrição preenchida"
            icon={Database}
          />
          <DimensionCard
            label="Governança"
            score={data.scores.governanca}
            description="Ativos com Data Owner e Steward"
            icon={Users}
          />
          <DimensionCard
            label="Qualidade"
            score={data.scores.qualidade}
            description="Ativos com score de qualidade ≥ 70"
            icon={Star}
          />
          <DimensionCard
            label="Acessos"
            score={data.scores.acessos}
            description="Solicitações de acesso resolvidas"
            icon={Shield}
          />
          <DimensionCard
            label="Glossário"
            score={data.scores.glossario}
            description="Termos aprovados no glossário"
            icon={BookOpen}
          />
        </div>
      </div>

      {/* Domain Quality Heatmap / Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">Qualidade Média por Domínio</CardTitle>
            </div>
            <CardDescription className="text-xs">Média calculada com base nos quality scores de cada ativo associado ao domínio.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={domainQuality} layout="vertical" margin={{ left: 40, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fontWeight: 600, fill: '#1B3A8C' }} 
                  width={140}
                />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                  {domainQuality?.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.value >= 70 ? '#10b981' : entry.value >= 40 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">Top Relevância</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {domainQuality?.sort((a: any, b: any) => b.assets - a.assets).slice(0, 5).map((d: any) => (
              <div key={d.name} className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-gray-700">{d.name}</span>
                  <Badge variant="secondary" className="text-[10px]">{d.assets} ativos</Badge>
                </div>
                <Progress value={d.value} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Stats grid */}
      <div>
        <h2 className="text-lg font-semibold text-[#1B3A8C] mb-1">Indicadores do Catálogo</h2>
        <p className="text-xs text-muted-foreground mb-4">Clique em qualquer indicador para ver os itens específicos.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <StatBadge
            label="Ativos Globais"
            value={data.stats.totalAssets}
            total={data.stats.totalAssets}
            onClick={() => setActiveKey("allAssets")}
          />
          <StatBadge
            label="Com Descrição"
            value={data.stats.withDesc}
            total={data.stats.totalAssets}
            onClick={data.stats.withDesc < data.stats.totalAssets ? () => setActiveKey("missingDesc") : undefined}
          />
          <StatBadge
            label="Com Data Owner"
            value={data.stats.withOwner}
            total={data.stats.totalAssets}
            onClick={data.stats.withOwner < data.stats.totalAssets ? () => setActiveKey("missingOwner") : undefined}
          />
          <StatBadge
            label="Com Steward"
            value={data.stats.withSteward}
            total={data.stats.totalAssets}
            onClick={data.stats.withSteward < data.stats.totalAssets ? () => setActiveKey("missingSteward") : undefined}
          />
          <StatBadge
            label="Alta Qualidade"
            value={data.stats.highQuality}
            total={data.stats.totalAssets}
            onClick={data.stats.highQuality < data.stats.totalAssets ? () => setActiveKey("lowQuality") : undefined}
          />
          <StatBadge
            label="Acessos Resolvidos"
            value={data.stats.resolvedAccessRequests}
            total={data.stats.totalAccessRequests}
            onClick={data.stats.resolvedAccessRequests < data.stats.totalAccessRequests ? () => setActiveKey("pendingAccess") : undefined}
          />
          <StatBadge
            label="Termos Aprovados"
            value={data.stats.glossaryApproved}
            total={Math.max(data.stats.glossaryApproved + (drilldown?.pendingGlossary?.length ?? 0), 10)}
            onClick={drilldown?.pendingGlossary?.length ? () => setActiveKey("pendingGlossary") : undefined}
          />
        </div>
      </div>

      {/* Drill-down Sheet */}
      <Sheet open={activeKey !== null} onOpenChange={(open) => { if (!open) setActiveKey(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {activeKey && (() => {
            const meta = drilldownMeta[activeKey];
            const MetaIcon = meta.icon;
            const items = drilldown?.[activeKey] ?? [];
            return (
              <>
                <SheetHeader className="pb-4 border-b">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${activeKey === "allAssets" ? "bg-blue-100" : "bg-orange-100"}`}>
                      <MetaIcon className={`h-5 w-5 ${activeKey === "allAssets" ? "text-blue-600" : "text-orange-600"}`} />
                    </div>
                    <div>
                      <SheetTitle className="text-base">{meta.title}</SheetTitle>
                      <SheetDescription className="text-xs mt-0.5">{meta.description}</SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                <div className="mt-4 space-y-2">
                  {items.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                      <CheckCircle2 className="h-10 w-10 text-green-400" />
                      <p className="font-medium text-green-700">{meta.emptyMsg}</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground mb-3">
                        {items.length} {items.length === 1 ? "item encontrado" : "itens encontrados"}
                      </p>
                      {activeKey === "allAssets"
                        ? (items as any[]).map((item: any) => (
                            <div key={item.id} className="flex items-start justify-between p-3 border rounded-lg hover:bg-blue-50">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{item.name}</p>
                                <p className="text-xs text-muted-foreground">{item.region ?? "—"} · {item.sourceSystem ?? "—"}</p>
                              </div>
                              <div className="flex items-center gap-2 ml-2 shrink-0">
                                {item.qualityScore !== undefined && (
                                  <span className={`text-[10px] font-bold ${
                                    (item.qualityScore ?? 0) >= 80 ? "text-green-700" :
                                    (item.qualityScore ?? 0) >= 60 ? "text-yellow-700" : "text-red-700"
                                  }`}>{item.qualityScore ?? "N/A"}%</span>
                                )}
                                <Badge variant="secondary" className="text-[10px]">{typeLabel(item.type)}</Badge>
                              </div>
                            </div>
                          ))
                        : activeKey === "pendingAccess"
                        ? (items as any[]).map((item: any) => (
                            <div key={item.id} className="flex items-start justify-between p-3 border rounded-lg hover:bg-gray-50">
                              <div>
                                <p className="font-medium text-sm">{item.ticketNumber}</p>
                                <p className="text-xs text-muted-foreground">{item.requesterName ?? "—"}</p>
                              </div>
                              <Badge variant="outline" className="text-[10px] text-orange-700 border-orange-300">
                                {item.status?.replace("pendente_", "") ?? "pendente"}
                              </Badge>
                            </div>
                          ))
                        : activeKey === "pendingGlossary"
                        ? (items as any[]).map((item: any) => (
                            <div key={item.id} className="flex items-start justify-between p-3 border rounded-lg hover:bg-gray-50">
                              <div>
                                <p className="font-medium text-sm">{item.term}</p>
                                {item.category && <p className="text-xs text-muted-foreground">{item.category}</p>}
                              </div>
                              <Badge variant="outline" className="text-[10px] capitalize text-yellow-700 border-yellow-300">
                                {item.status?.replace("_", " ") ?? "rascunho"}
                              </Badge>
                            </div>
                          ))
                        : (items as any[]).map((item: any) => (
                            <div key={item.id} className="flex items-start justify-between p-3 border rounded-lg hover:bg-gray-50">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{item.name}</p>
                                {item.qualityScore !== undefined && (
                                  <p className="text-xs text-muted-foreground">Score: {item.qualityScore ?? "sem dados"}</p>
                                )}
                              </div>
                              <Badge variant="secondary" className="text-[10px] ml-2 shrink-0">
                                {typeLabel(item.type)}
                              </Badge>
                            </div>
                          ))
                      }
                    </>
                  )}
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            Recomendações de Melhoria
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {data.scores.descricao < 80 && (
              <li className="flex items-start gap-2 text-sm">
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <span>
                  <strong>Descrições:</strong> {data.stats.totalAssets - data.stats.withDesc} ativos sem descrição.
                  Preencha a coluna "Descrição" no catálogo para melhorar descoberta e qualidade.
                </span>
              </li>
            )}
            {data.scores.governanca < 80 && (
              <li className="flex items-start gap-2 text-sm">
                <XCircle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                <span>
                  <strong>Governança:</strong> {data.stats.totalAssets - data.stats.withOwner} ativos sem Data Owner;
                  {" "}{data.stats.totalAssets - data.stats.withSteward} sem Data Steward.
                  Atribua responsáveis para garantir accountability.
                </span>
              </li>
            )}
            {data.scores.qualidade < 70 && (
              <li className="flex items-start gap-2 text-sm">
                <XCircle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                <span>
                  <strong>Qualidade:</strong> Execute o motor de qualidade para mais ativos e
                  configure regras de qualidade no catálogo.
                </span>
              </li>
            )}
            {data.scores.acessos < 80 && (
              <li className="flex items-start gap-2 text-sm">
                <XCircle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <span>
                  <strong>Acessos:</strong> {data.stats.totalAccessRequests - data.stats.resolvedAccessRequests} solicitações
                  pendentes. Processe as aprovações para melhorar o SLA de acesso.
                </span>
              </li>
            )}
            {data.scores.glossario < 60 && (
              <li className="flex items-start gap-2 text-sm">
                <XCircle className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
                <span>
                  <strong>Glossário:</strong> Apenas {data.stats.glossaryApproved} termos aprovados.
                  Expanda o glossário de negócios para padronizar o vocabulário de dados.
                </span>
              </li>
            )}
            {overall >= 80 && (
              <li className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                <span><strong>Parabéns!</strong> O programa de governança atingiu nível Otimizado. Mantenha o monitoramento contínuo.</span>
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
