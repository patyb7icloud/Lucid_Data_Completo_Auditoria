import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { 
  ShieldCheck, 
  Lock, 
  EyeOff, 
  AlertTriangle, 
  Database,
  Search,
  CheckCircle2,
  ChevronRight,
  FileCheck,
  Activity,
  X,
  ExternalLink,
} from "lucide-react";
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";

// ─── Tipos de drill-down disponíveis ─────────────────────────────────────────
type DrillDownType = "sensitive" | "protected" | "risk" | "compliance" | null;

const DRILL_DOWN_CONFIG: Record<
  Exclude<DrillDownType, null>,
  { title: string; description: string; icon: React.ReactNode; emptyMessage: string }
> = {
  sensitive: {
    title: "Ativos Sensíveis",
    description: "Ativos classificados como Restrito ou Confidencial no inventário.",
    icon: <EyeOff size={18} className="text-amber-600" />,
    emptyMessage: "Nenhum ativo sensível encontrado.",
  },
  protected: {
    title: "Ativos Protegidos",
    description: "Ativos sensíveis com score de qualidade ≥ 80%.",
    icon: <ShieldCheck size={18} className="text-green-600" />,
    emptyMessage: "Nenhum ativo protegido encontrado.",
  },
  risk: {
    title: "Ativos Sob Risco",
    description: "Ativos sensíveis com score de qualidade < 80% ou criticidade crítica.",
    icon: <AlertTriangle size={18} className="text-red-600" />,
    emptyMessage: "Nenhum ativo sob risco — parabéns!",
  },
  compliance: {
    title: "Ativos Em Conformidade",
    description: "Ativos sensíveis que atendem aos critérios de proteção e qualidade.",
    icon: <FileCheck size={18} className="text-blue-600" />,
    emptyMessage: "Nenhum ativo em conformidade encontrado.",
  },
};

// ─── Modal de drill-down ──────────────────────────────────────────────────────
function DrillDownModal({
  type,
  assets,
  onClose,
}: {
  type: Exclude<DrillDownType, null>;
  assets: any[];
  onClose: () => void;
}) {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const config = DRILL_DOWN_CONFIG[type];

  const filtered = useMemo(
    () =>
      assets.filter((a) =>
        (a.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (a.businessArea || "").toLowerCase().includes(search.toLowerCase()) ||
        (a.sourceSystem || "").toLowerCase().includes(search.toLowerCase())
      ),
    [assets, search]
  );

  const sensitivityColor: Record<string, string> = {
    restrito: "bg-red-50 text-red-700 border-red-200",
    confidencial: "bg-orange-50 text-orange-700 border-orange-200",
    interno: "bg-blue-50 text-blue-700 border-blue-200",
    publico: "bg-green-50 text-green-700 border-green-200",
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            {config.icon}
            {config.title}
            <Badge variant="outline" className="ml-1 text-xs font-bold">
              {assets.length}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            {config.description}
          </DialogDescription>
        </DialogHeader>

        {/* Busca */}
        <div className="relative mt-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="Buscar por nome, área ou sistema..."
            className="pl-8 h-8 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Lista */}
        <div className="overflow-y-auto flex-1 divide-y divide-gray-100 rounded-lg border border-gray-100 mt-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">{config.emptyMessage}</div>
          ) : (
            filtered.map((asset) => {
              const isLowQuality = (Number(asset.qualityScore) || 0) < 80;
              const sensClass =
                sensitivityColor[asset.sensitivity ?? "interno"] ??
                sensitivityColor.interno;
              return (
                <div
                  key={asset.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-lg border flex-shrink-0 ${
                        isLowQuality
                          ? "bg-red-50 text-red-600 border-red-100"
                          : "bg-green-50 text-green-600 border-green-100"
                      }`}
                    >
                      {isLowQuality ? (
                        <AlertTriangle size={14} />
                      ) : (
                        <ShieldCheck size={14} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm text-gray-900 truncate">
                          {asset.name}
                        </p>
                        <Badge
                          className={`text-[9px] font-bold h-4 border ${sensClass}`}
                        >
                          {(asset.sensitivity || "interno").toUpperCase()}
                        </Badge>
                        <Badge className="bg-red-50 text-red-700 border-red-200 text-[9px] font-bold h-4 border">
                          LGPD
                        </Badge>
                      </div>
                      <p className="text-[10px] text-gray-400 font-medium uppercase tracking-tight mt-0.5">
                        Área: {asset.businessArea || "—"} · Sistema:{" "}
                        {asset.sourceSystem || "—"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0 ml-2">
                    <div className="text-right hidden sm:block">
                      <p className="text-[9px] font-bold text-gray-400 uppercase">
                        Qualidade
                      </p>
                      <div className="flex items-center gap-1.5">
                        <Progress
                          value={Number(asset.qualityScore) || 0}
                          className="h-1 w-12"
                        />
                        <span
                          className={`text-xs font-black ${
                            isLowQuality ? "text-red-600" : "text-green-600"
                          }`}
                        >
                          {asset.qualityScore ?? 0}%
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 hover:bg-blue-50 text-blue-600"
                      onClick={() => {
                        onClose();
                        setLocation("/catalogo");
                      }}
                      title="Ver no catálogo"
                    >
                      <ExternalLink size={13} />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>
            <X size={13} className="mr-1" /> Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Card de KPI clicável ─────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon: Icon,
  color,
  onClick,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  onClick?: () => void;
}) {
  return (
    <Card
      className={`border-none shadow-sm bg-white transition-all duration-150 ${
        onClick
          ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:ring-2 hover:ring-offset-1 hover:ring-blue-200"
          : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`p-3 rounded-2xl bg-gray-50 ${color}`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {label}
          </p>
          <p className={`text-xl font-black ${color}`}>{value}</p>
        </div>
        {onClick && (
          <ChevronRight size={14} className="ml-auto text-gray-300" />
        )}
      </CardContent>
    </Card>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function ComplianceLGPD() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [drillDown, setDrillDown] = useState<DrillDownType>(null);

  const { data: assets, isLoading } = trpc.governance.listAssets.useQuery({});

  const sensitiveAssets = useMemo(() => {
    if (!assets || !Array.isArray(assets)) return [];
    return assets.filter(
      (a) => a.sensitivity === "restrito" || a.sensitivity === "confidencial"
    );
  }, [assets]);

  const protectedList = useMemo(
    () => sensitiveAssets.filter((a) => (Number(a.qualityScore) || 0) >= 80),
    [sensitiveAssets]
  );

  const riskList = useMemo(
    () =>
      sensitiveAssets.filter(
        (a) => (Number(a.qualityScore) || 0) < 80 || a.criticality === "critica"
      ),
    [sensitiveAssets]
  );

  const stats = useMemo(() => {
    const complianceScore =
      sensitiveAssets.length > 0
        ? Math.round((protectedList.length / sensitiveAssets.length) * 100)
        : 100;
    return {
      totalSensitive: sensitiveAssets.length,
      protected: protectedList.length,
      criticalRisk: riskList.length,
      complianceScore,
    };
  }, [sensitiveAssets, protectedList, riskList]);

  // Lista usada pelo modal de conformidade = mesma que protegidos
  const complianceList = protectedList;

  function getDrillDownAssets(type: Exclude<DrillDownType, null>) {
    switch (type) {
      case "sensitive":
        return sensitiveAssets;
      case "protected":
        return protectedList;
      case "risk":
        return riskList;
      case "compliance":
        return complianceList;
    }
  }

  const sensitivityDistribution = [
    {
      name: "Público",
      value: assets?.filter((a) => a.sensitivity === "publico").length || 0,
      color: "#6DC23A",
    },
    {
      name: "Interno",
      value: assets?.filter((a) => a.sensitivity === "interno").length || 0,
      color: "#1B3A8C",
    },
    {
      name: "Restrito",
      value: assets?.filter((a) => a.sensitivity === "restrito").length || 0,
      color: "#ef4444",
    },
  ];

  if (isLoading)
    return (
      <div className="p-8 text-center font-bold text-red-900 animate-pulse">
        Monitorando Privacidade...
      </div>
    );

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-900">
            <Lock className="h-6 w-6 text-red-600" /> Compliance LGPD
          </h1>
          <p className="text-sm text-gray-500 font-medium">
            Privacidade e Proteção de Dados Pessoais (PII).
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] font-bold text-gray-400 uppercase">
              Conformidade Geral
            </p>
            <p
              className={`text-xl font-black ${
                stats.complianceScore > 80 ? "text-green-600" : "text-red-600"
              }`}
            >
              {stats.complianceScore}%
            </p>
          </div>
          <Badge
            className={`${
              stats.criticalRisk > 0
                ? "bg-red-50 text-red-700"
                : "bg-green-50 text-green-700"
            } px-3 py-1 font-bold`}
          >
            Risco: {stats.criticalRisk > 0 ? "Médio" : "Baixo"}
          </Badge>
        </div>
      </div>

      {/* Cards de KPI clicáveis */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Ativos Sensíveis"
          value={stats.totalSensitive}
          icon={EyeOff}
          color="text-amber-600"
          onClick={() => setDrillDown("sensitive")}
        />
        <StatCard
          label="Protegidos"
          value={stats.protected}
          icon={ShieldCheck}
          color="text-green-600"
          onClick={() => setDrillDown("protected")}
        />
        <StatCard
          label="Sob Risco"
          value={stats.criticalRisk}
          icon={AlertTriangle}
          color="text-red-600"
          onClick={() => setDrillDown("risk")}
        />
        <StatCard
          label="Em Conformidade"
          value={`${stats.complianceScore}%`}
          icon={FileCheck}
          color="text-blue-600"
          onClick={() => setDrillDown("compliance")}
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database size={18} className="text-blue-600" /> Sensibilidade
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sensitivityDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  dataKey="value"
                  paddingAngle={5}
                >
                  {sensitivityDistribution.map((e, i) => (
                    <Cell key={i} fill={e.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity size={18} className="text-blue-600" /> Radar de Risco Jurídico
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart
                cx="50%"
                cy="50%"
                outerRadius="70%"
                data={[
                  { subject: "Consentimento", A: 85 },
                  { subject: "Retenção", A: 70 },
                  { subject: "Segurança", A: 90 },
                  { subject: "Acesso", A: 95 },
                ]}
              >
                <PolarGrid stroke="#f1f5f9" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                />
                <Radar
                  name="Risco"
                  dataKey="A"
                  stroke="#1B3A8C"
                  fill="#1B3A8C"
                  fillOpacity={0.5}
                />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Lista de ativos sensíveis */}
      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <CardHeader className="bg-gray-50/50 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar ativos sensíveis (Ex: CPF, Clientes)..."
              className="pl-9 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100">
            {sensitiveAssets
              .filter((a) =>
                (a.name || "").toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map((asset) => {
                const isLowQuality = (Number(asset.qualityScore) || 0) < 80;
                return (
                  <div
                    key={asset.id}
                    className="p-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`p-3 rounded-xl border ${
                          isLowQuality
                            ? "bg-red-50 text-red-600 border-red-100"
                            : "bg-green-50 text-green-600 border-green-100"
                        }`}
                      >
                        {isLowQuality ? (
                          <AlertTriangle size={20} />
                        ) : (
                          <ShieldCheck size={20} />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-black text-sm text-gray-900">
                            {asset.name}
                          </p>
                          <Badge className="bg-red-50 text-red-700 text-[8px] font-bold h-4">
                            LGPD
                          </Badge>
                        </div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter mt-0.5">
                          Área: {asset.businessArea || "Comercial"} · Sistema:{" "}
                          {asset.sourceSystem || "SAP"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">
                          Status de Saúde
                        </p>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={Number(asset.qualityScore) || 0}
                            className="h-1 w-12"
                          />
                          <span
                            className={`text-xs font-black ${
                              isLowQuality ? "text-red-600" : "text-green-600"
                            }`}
                          >
                            {asset.qualityScore}%
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLocation("/catalogo")}
                        className="hover:bg-blue-50 text-blue-600"
                      >
                        <ChevronRight size={16} />
                      </Button>
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* Modal de drill-down */}
      {drillDown && (
        <DrillDownModal
          type={drillDown}
          assets={getDrillDownAssets(drillDown)}
          onClose={() => setDrillDown(null)}
        />
      )}
    </div>
  );
}
