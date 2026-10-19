import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  TrendingUp, 
  Database,
  BarChart3,
  Search,
  Settings2,
  Plus,
  Loader2,
  ChevronRight,
  Target,
  FlaskConical,
  Save,
  CheckCircle,
  Layers,
  Info,
  Regex
} from "lucide-react";
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function DataQuality() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [historyAssetId, setHistoryAssetId] = useState<number | null>(null);
  
  // Regras Dinâmicas (Mapeia dimensionId -> { threshold, json })
  const [draftRules, setDraftRules] = useState<Record<number, { threshold: number, json: string }>>({});

  const utils = trpc.useContext();
  const { data: assets, refetch: refetchAssets } = trpc.governance.listAssets.useQuery({});
  const { data: existingRules } = trpc.governance.getQualityRules.useQuery(
    { assetId: selectedAsset?.id },
    { enabled: !!selectedAsset }
  );
  const { data: historyDataRaw } = trpc.governance.getQualityHistory.useQuery(
    { assetId: historyAssetId || 0, days: 30 },
    { enabled: !!historyAssetId }
  );
  const { data: globalDimensions } = trpc.governance.getGlobalQualityDimensions.useQuery();
  const { data: qualityDimensions } = trpc.governance.getQualityDimensions.useQuery();
  const { data: assetAttributes } = trpc.governance.getAttributes.useQuery(
    { assetId: selectedAsset?.id ?? 0 },
    { enabled: !!selectedAsset }
  );

  const [isGlobalScanRunning, setIsGlobalScanRunning] = useState(false);
  const [runningAssetId, setRunningAssetId] = useState<number | null>(null);

  const runGlobalChecksMut = trpc.governance.runGlobalChecks.useMutation();
  const runChecksMut = trpc.governance.runChecks.useMutation();

  async function handleGlobalScan() {
    setIsGlobalScanRunning(true);
    try {
      const res = await runGlobalChecksMut.mutateAsync();
      toast.success(`Scan concluído! ${res.assetsProcessed} ativos verificados.`);
      refetchAssets();
    } catch {
      toast.error('Erro ao executar scan global');
    } finally {
      setIsGlobalScanRunning(false);
    }
  }

  async function handleRunChecks(assetId: number) {
    setRunningAssetId(assetId);
    try {
      const res = await runChecksMut.mutateAsync({ assetId });
      if (res.ok) {
        toast.success('Checks executados com sucesso!');
      } else {
        toast.warning('Checks finalizados com aviso', { description: res.message });
      }
      refetchAssets();
    } catch {
      toast.error('Erro ao executar checks');
    } finally {
      setRunningAssetId(null);
    }
  }

  const updateRule = trpc.governance.updateQualityRule.useMutation({
    onSuccess: () => {
      utils.governance.getQualityRules.invalidate();
    }
  });

  const DIMENSION_CONFIG: Record<string, { label: string; color: string }> = {
    completude:   { label: "Completude",   color: "#1B3A8C" },
    unicidade:    { label: "Unicidade",    color: "#6DC23A" },
    validade:     { label: "Validade",     color: "#0ea5e9" },
    consistencia: { label: "Consistência", color: "#f59e0b" },
    atualidade:   { label: "Atualidade",   color: "#8b5cf6" },
  };

  const FALLBACK_DIMENSIONS = [
    { name: "Completude",   value: 0, color: "#1B3A8C" },
    { name: "Unicidade",    value: 0, color: "#6DC23A" },
    { name: "Validade",     value: 0, color: "#0ea5e9" },
    { name: "Consistência", value: 0, color: "#f59e0b" },
  ];

  const qualityData = useMemo(() => {
    if (!globalDimensions || globalDimensions.length === 0) return FALLBACK_DIMENSIONS;
    return globalDimensions.map(d => {
      const cfg = DIMENSION_CONFIG[d.metricName] ?? { label: d.metricName, color: "#94a3b8" };
      return { name: cfg.label, value: Math.round(Number(d.avgScore) || 0), color: cfg.color };
    });
  }, [globalDimensions]);

  const chartHistoryData = useMemo(() => {
    if (!historyDataRaw || historyDataRaw.length === 0) {
      return [
        { data: "Jan", score: 82 },
        { data: "Fev", score: 85 },
        { data: "Mar", score: 84 },
        { data: "Abr", score: 89 },
        { data: "Mai", score: 91 },
      ];
    }
    return historyDataRaw.map(h => ({
      data: format(new Date(h.measuredAt), 'dd/MM', { locale: ptBR }),
      score: Math.round(Number(h.avgScore) || 0),
      originalDate: h.measuredAt,
    })).reverse();
  }, [historyDataRaw]);

  const handleOpenConfig = (asset: any) => {
    setSelectedAsset(asset);
    setIsConfigOpen(true);
  };

  const handleViewHistory = (asset: any) => {
    setHistoryAssetId(asset.id);
  };

  useEffect(() => {
    if (existingRules) {
      const draft: Record<number, { threshold: number, json: string }> = {};
      existingRules.forEach(r => {
        draft[r.dimensionId] = {
          threshold: r.threshold ?? 95,
          json: r.expressionJson ? JSON.stringify(r.expressionJson) : ""
        };
      });
      setDraftRules(draft);
    }
  }, [existingRules]);

  const handleSaveRules = async () => {
    if (!selectedAsset) return;
    
    for (const [dimId, data] of Object.entries(draftRules)) {
      if (!data.json.trim()) continue; // pula regras sem json definido
      
      let exprJson = undefined;
      try {
        exprJson = JSON.parse(data.json);
      } catch(e) {
        toast.error(`JSON inválido na dimensão ID ${dimId}`);
        return;
      }

      await updateRule.mutateAsync({
        assetId: selectedAsset.id,
        dimensionId: Number(dimId),
        threshold: data.threshold,
        expressionJson: exprJson
      });
    }

    toast.success("Regras salvas com sucesso!");
    setIsConfigOpen(false);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-[#1B3A8C]" />
            Observabilidade & Qualidade de Dados
          </h1>
          <p className="text-sm text-gray-500 mt-1 font-medium italic text-blue-600">
            Monitorando {assets?.length || 0} ativos corporativos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2 border-blue-100 text-blue-700 bg-blue-50/50 hover:bg-blue-100"
            disabled={isGlobalScanRunning}
            onClick={handleGlobalScan}
          >
            {isGlobalScanRunning
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <FlaskConical className="h-4 w-4" />}
            {isGlobalScanRunning ? 'Executando...' : 'Executar Scan Global'}
          </Button>
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 px-3 py-1 font-bold">
            Saúde Global: {assets?.length ? Math.round(assets.reduce((s, a) => s + (a.qualityScore ?? 0), 0) / assets.length) : 0}%
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm lg:col-span-1 bg-white">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              Saúde por Dimensão
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={qualityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {qualityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="bottom" iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm lg:col-span-2 bg-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Evolução da Confiabilidade
                </CardTitle>
                <CardDescription className="text-xs">
                  {historyAssetId 
                    ? `Tendência do ativo: ${assets?.find(a => a.id === historyAssetId)?.name}` 
                    : "Média Global de Qualidade (Visão Corporativa)"}
                </CardDescription>
              </div>
              {historyAssetId && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-[10px] h-7 px-2 font-bold uppercase"
                  onClick={() => setHistoryAssetId(null)}
                >
                  Ver Global
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartHistoryData}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1B3A8C" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#1B3A8C" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis 
                  dataKey="data" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 10}} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  domain={[0, 100]} 
                  tick={{fill: '#94a3b8', fontSize: 10}} 
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#1B3A8C' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#1B3A8C" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorScore)" 
                  dot={{ r: 4, fill: '#1B3A8C', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-md overflow-hidden bg-white">
        <CardHeader className="bg-gray-50/50 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg text-[#1B3A8C]">Monitoramento por Ativo Critico</CardTitle>
              <CardDescription className="text-xs">Defina os thresholds de aceitação para cada sistema.</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Filtrar sistemas..." className="pl-9 h-9 border-gray-200" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100">
            {assets?.filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase())).map((asset) => (
              <div key={asset.id} className="p-5 flex items-center justify-between hover:bg-blue-50/20 transition-colors group">
                <div className="flex items-center gap-5">
                  <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-100 group-hover:border-blue-200 group-hover:scale-110 transition-all">
                    <Database className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
                      {asset.name}
                      <Badge variant="outline" className="text-[9px] h-4 bg-gray-50 border-gray-100">{asset.sourceSystem}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <Progress value={asset.qualityScore || 0} className="h-2 w-48 bg-gray-100" />
                      <span className="text-xs font-black text-gray-600">{asset.qualityScore || 0}%</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right hidden md:block">
                    <div className={`text-xs font-bold flex items-center justify-end gap-1 ${ (asset.qualityScore || 0) >= 80 ? 'text-green-600' : 'text-amber-600' }`}>
                      <TrendingUp className="h-3 w-3" /> Tendência Positiva
                    </div>
                    <Button 
                      variant="link" 
                      className="p-0 h-auto text-[10px] text-gray-400 uppercase font-bold tracking-tighter hover:text-blue-600"
                      onClick={() => handleViewHistory(asset)}
                    >
                      Ver Histórico
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-green-700 hover:bg-green-50 font-bold text-xs border border-transparent hover:border-green-100"
                    disabled={runningAssetId === asset.id}
                    onClick={() => handleRunChecks(asset.id)}
                  >
                    {runningAssetId === asset.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <FlaskConical className="h-4 w-4" />}
                    Executar
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="gap-2 text-[#1B3A8C] hover:bg-blue-50 font-bold text-xs border border-transparent hover:border-blue-100"
                    onClick={() => handleOpenConfig(asset)}
                  >
                    <Settings2 className="h-4 w-4" /> Configurar Regras
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="max-w-2xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#1B3A8C] text-xl">
              <Settings2 className="h-6 w-6" />
              Configurar Regras: {selectedAsset?.name}
            </DialogTitle>
            <DialogDescription>
              Defina os critérios técnicos que o motor de qualidade deve validar.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {qualityDimensions?.map((dim) => {
                const metricName = Object.entries(DIMENSION_CONFIG).find(([, cfg]) => cfg.label === dim.name)?.[0] ?? dim.name.toLowerCase();
                const draft = draftRules[dim.id] || { threshold: 95, json: "" };
                
                let checkedCols: string[] = [];
                let uniqueCol = "";
                let dateCol = "";
                let regexCols: Record<string, string> = {};
                let consCols: Record<string, {op: string, val: string}> = {};

                if (draft.json) {
                  try {
                    const parsed = JSON.parse(draft.json);
                    if (metricName === "completude" && parsed.and && Array.isArray(parsed.and)) {
                      checkedCols = parsed.and.filter((c: any) => c.operator === "isNotNull" && c.field).map((c: any) => c.field);
                    }
                    if (metricName === "unicidade" && parsed.field && parsed.operator === "isUnique") {
                      uniqueCol = parsed.field;
                    }
                    if (metricName === "atualidade" && parsed.field && parsed.operator === "isDateColumn") {
                      dateCol = parsed.field;
                    }
                    if (metricName === "validade" && parsed.and && Array.isArray(parsed.and)) {
                      parsed.and.forEach((c: any) => {
                        if (c.operator === "regex" && c.field) regexCols[c.field] = c.value;
                      });
                    }
                    if (metricName === "consistencia" && parsed.and && Array.isArray(parsed.and)) {
                      parsed.and.forEach((c: any) => {
                        if (c.field && c.operator && c.value !== undefined) consCols[c.field] = { op: c.operator, val: c.value };
                      });
                    }
                  } catch(e) {}
                }

                const toggleColumn = (colName: string, checked: boolean) => {
                  let newCols = [...checkedCols];
                  if (checked) {
                    newCols.push(colName);
                  } else {
                    newCols = newCols.filter(c => c !== colName);
                  }
                  const newJson = newCols.length > 0 ? JSON.stringify({
                    and: newCols.map(c => ({ field: c, operator: "isNotNull" }))
                  }, null, 2) : "";
                  setDraftRules({ ...draftRules, [dim.id]: { ...draft, json: newJson }});
                };

                const setUniqueCol = (col: string) => {
                  const newJson = col && col !== "none" ? JSON.stringify({ field: col, operator: "isUnique" }, null, 2) : "";
                  setDraftRules({ ...draftRules, [dim.id]: { ...draft, json: newJson }});
                };

                const setDateCol = (col: string) => {
                  const newJson = col && col !== "none" ? JSON.stringify({ field: col, operator: "isDateColumn" }, null, 2) : "";
                  setDraftRules({ ...draftRules, [dim.id]: { ...draft, json: newJson }});
                };

                const setRegex = (col: string, val: string) => {
                  const newCols = { ...regexCols };
                  if (val && val !== "none") newCols[col] = val;
                  else delete newCols[col];
                  
                  const entries = Object.entries(newCols);
                  const newJson = entries.length > 0 ? JSON.stringify({
                    and: entries.map(([f, v]) => ({ field: f, operator: "regex", value: v }))
                  }, null, 2) : "";
                  setDraftRules({ ...draftRules, [dim.id]: { ...draft, json: newJson }});
                };

                const setCons = (col: string, op: string, val: string) => {
                  const newCols = { ...consCols };
                  if (op && op !== "none" && val !== "") newCols[col] = { op, val };
                  else delete newCols[col];
                  
                  const entries = Object.entries(newCols);
                  const newJson = entries.length > 0 ? JSON.stringify({
                    and: entries.map(([f, c]) => ({ field: f, operator: c.op, value: c.val }))
                  }, null, 2) : "";
                  setDraftRules({ ...draftRules, [dim.id]: { ...draft, json: newJson }});
                };

                return (
                  <div key={dim.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 group">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dim.color || '#ccc' }} />
                        <div>
                          <p className="text-sm font-bold text-gray-800">{dim.name}</p>
                          <p className="text-[10px] text-gray-500">{dim.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500">Threshold:</span>
                        <Input 
                          type="number" 
                          value={draft.threshold} 
                          onChange={(e) => setDraftRules({
                            ...draftRules,
                            [dim.id]: { ...draft, threshold: Number(e.target.value) }
                          })}
                          className="w-16 h-8 text-center font-bold border-gray-200" 
                        />
                        <span className="text-sm font-bold text-gray-400">%</span>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                        <Tabs defaultValue="visual" className="w-full">
                          <TabsList className="grid w-full grid-cols-2 mb-4 bg-gray-100/50">
                            <TabsTrigger value="visual" className="text-xs font-bold">Construtor Visual</TabsTrigger>
                            <TabsTrigger value="json" className="text-xs font-bold">JSON Avançado</TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="visual" className="space-y-4">
                             {metricName === "completude" && (
                               <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto p-4 bg-white rounded-lg border border-gray-200 shadow-inner">
                                  {assetAttributes?.map(attr => (
                                    <div key={attr.id} className="flex items-center space-x-2">
                                      <Checkbox 
                                        id={`col-${dim.id}-${attr.id}`}
                                        checked={checkedCols.includes(attr.name)}
                                        onCheckedChange={(c) => toggleColumn(attr.name, !!c)}
                                      />
                                      <label htmlFor={`col-${dim.id}-${attr.id}`} className="text-sm font-medium leading-none cursor-pointer text-gray-700 truncate">
                                        {attr.name} <span className="text-[10px] text-gray-400 font-mono">({attr.dataType})</span>
                                      </label>
                                    </div>
                                  ))}
                                  {!assetAttributes?.length && (
                                    <div className="col-span-2 text-xs text-gray-500 text-center py-4">Nenhuma coluna detectada neste ativo. Sincronize o catálogo.</div>
                                  )}
                                  <div className="col-span-2 mt-2">
                                    <p className="text-xs text-gray-500 italic">Marque as colunas que são obrigatórias (não podem ser nulas) de acordo com a regra de negócio.</p>
                                  </div>
                               </div>
                             )}

                             {metricName === "unicidade" && (
                               <div className="space-y-3 p-4 bg-white rounded-lg border border-gray-200 shadow-inner">
                                 <p className="text-xs text-gray-500 font-medium">Selecione a coluna que atua como chave primária ou que não deve conter valores duplicados.</p>
                                 <Select value={uniqueCol || "none"} onValueChange={setUniqueCol}>
                                   <SelectTrigger className="w-full text-xs h-9">
                                     <SelectValue placeholder="Selecione uma coluna..." />
                                   </SelectTrigger>
                                   <SelectContent>
                                     <SelectItem value="none">Nenhuma</SelectItem>
                                     {assetAttributes?.map(attr => (
                                        <SelectItem key={attr.id} value={attr.name}>{attr.name} <span className="text-gray-400">({attr.dataType})</span></SelectItem>
                                     ))}
                                   </SelectContent>
                                 </Select>
                               </div>
                             )}

                             {metricName === "atualidade" && (
                               <div className="space-y-3 p-4 bg-white rounded-lg border border-gray-200 shadow-inner">
                                 <p className="text-xs text-gray-500 font-medium">Selecione a coluna de data (timestamp) que indica a última modificação do registro.</p>
                                 <Select value={dateCol || "none"} onValueChange={setDateCol}>
                                   <SelectTrigger className="w-full text-xs h-9">
                                     <SelectValue placeholder="Selecione uma coluna de data..." />
                                   </SelectTrigger>
                                   <SelectContent>
                                     <SelectItem value="none">Nenhuma</SelectItem>
                                     {assetAttributes?.filter(a => (a.dataType ?? '').toLowerCase().includes('date') || (a.dataType ?? '').toLowerCase().includes('time') || (a.dataType ?? '').toLowerCase().includes('timestamp')).map(attr => (
                                        <SelectItem key={attr.id} value={attr.name}>{attr.name} <span className="text-gray-400">({attr.dataType})</span></SelectItem>
                                     ))}
                                   </SelectContent>
                                 </Select>
                               </div>
                             )}

                             {metricName === "validade" && (
                               <div className="space-y-3 p-4 bg-white rounded-lg border border-gray-200 shadow-inner">
                                 <p className="text-xs text-gray-500 font-medium">Defina um formato válido (Regex) para colunas específicas (ex: e-mail, CPF, CNPJ).</p>
                                 <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                   {assetAttributes?.map(attr => {
                                      const isCustom = regexCols[attr.name] && !["^.+@.+$", "^\\d{11}$", "^\\d{14}$"].includes(regexCols[attr.name]);
                                      const dropdownValue = regexCols[attr.name] ? (isCustom ? "custom" : regexCols[attr.name]) : "none";
                                      
                                      return (
                                        <div key={attr.id} className="flex gap-2 items-center bg-gray-50 p-2 rounded-md border border-gray-100">
                                           <span className="text-xs font-bold w-1/3 truncate text-gray-700" title={attr.name}>{attr.name}</span>
                                           <Select value={dropdownValue} onValueChange={(v) => {
                                              if (v === "custom") setRegex(attr.name, "."); // placeholder para custom
                                              else setRegex(attr.name, v);
                                           }}>
                                              <SelectTrigger className="w-1/3 h-8 text-[10px] bg-white"><SelectValue placeholder="Padrão..." /></SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="none">Nenhum</SelectItem>
                                                <SelectItem value="^.+@.+$">E-mail</SelectItem>
                                                <SelectItem value="^\d{11}$">CPF (11 dígitos)</SelectItem>
                                                <SelectItem value="^\d{14}$">CNPJ (14 dígitos)</SelectItem>
                                                <SelectItem value="custom">Customizado...</SelectItem>
                                              </SelectContent>
                                           </Select>
                                           <Input 
                                              className="h-8 text-[10px] flex-1 bg-white" 
                                              placeholder="Regex custom..." 
                                              value={regexCols[attr.name] || ""} 
                                              onChange={(e) => setRegex(attr.name, e.target.value)} 
                                              disabled={dropdownValue !== "custom"}
                                           />
                                        </div>
                                      )
                                   })}
                                   {!assetAttributes?.length && (
                                     <div className="text-xs text-gray-500 text-center py-4">Nenhuma coluna detectada neste ativo.</div>
                                   )}
                                 </div>
                               </div>
                             )}

                             {metricName === "consistencia" && (
                               <div className="space-y-3 p-4 bg-white rounded-lg border border-gray-200 shadow-inner">
                                 <p className="text-xs text-gray-500 font-medium">Defina limites numéricos para colunas.</p>
                                 <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                   {assetAttributes?.filter(a => (a.dataType ?? '').toLowerCase().includes('int') || (a.dataType ?? '').toLowerCase().includes('float') || (a.dataType ?? '').toLowerCase().includes('numeric') || (a.dataType ?? '').toLowerCase().includes('decimal')).map(attr => (
                                      <div key={attr.id} className="flex gap-2 items-center bg-gray-50 p-2 rounded-md border border-gray-100">
                                         <span className="text-xs font-bold w-1/3 truncate text-gray-700" title={attr.name}>{attr.name}</span>
                                         <Select value={consCols[attr.name]?.op || "none"} onValueChange={(v) => setCons(attr.name, v, consCols[attr.name]?.val || "0")}>
                                            <SelectTrigger className="w-1/3 h-8 text-[10px] bg-white"><SelectValue placeholder="Regra..." /></SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="none">Nenhuma</SelectItem>
                                              <SelectItem value="greaterThan">&gt; Maior que</SelectItem>
                                              <SelectItem value="lessThan">&lt; Menor que</SelectItem>
                                              <SelectItem value="equals">= Igual a</SelectItem>
                                            </SelectContent>
                                         </Select>
                                         <Input 
                                            type="number"
                                            className="h-8 text-[10px] flex-1 bg-white" 
                                            placeholder="Valor..." 
                                            value={consCols[attr.name]?.val || ""} 
                                            onChange={(e) => setCons(attr.name, consCols[attr.name]?.op || "greaterThan", e.target.value)} 
                                            disabled={!consCols[attr.name]?.op || consCols[attr.name]?.op === "none"}
                                         />
                                      </div>
                                   ))}
                                   {!assetAttributes?.filter(a => (a.dataType ?? '').toLowerCase().includes('int') || (a.dataType ?? '').toLowerCase().includes('float') || (a.dataType ?? '').toLowerCase().includes('numeric') || (a.dataType ?? '').toLowerCase().includes('decimal'))?.length && (
                                     <div className="text-xs text-gray-500 text-center py-4">Nenhuma coluna numérica detectada neste ativo.</div>
                                   )}
                                 </div>
                               </div>
                             )}
                          </TabsContent>
                          
                          <TabsContent value="json">
                            <div className="mt-2 space-y-2">
                              <label className="text-[10px] font-bold uppercase text-gray-400 flex items-center gap-2">
                                Condição JSON (Regra Engine)
                                <Info className="h-3 w-3 text-blue-500 cursor-help" aria-label='Exemplo de condição JSON' />
                              </label>
                              <textarea
                                className="w-full text-xs font-mono p-2 border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[60px]"
                                placeholder={'{"field": "isVerified", "operator": "isTrue"}'}
                                value={draft.json}
                                onChange={(e) => setDraftRules({
                                    ...draftRules,
                                    [dim.id]: { ...draft, json: e.target.value }
                                })}
                              />
                            </div>
                          </TabsContent>
                        </Tabs>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex gap-3">
              <Info className="h-5 w-5 text-blue-600 shrink-0" />
              <p className="text-[11px] text-blue-800 leading-relaxed">
                <strong>Motor Dinâmico:</strong> Escreva a condição em JSON. Operadores suportados: isNotNull, isNull, isTrue, isFalse, regex, equals, notEquals.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-3 mt-4">
            <Button variant="ghost" onClick={() => setIsConfigOpen(false)}>Cancelar</Button>
            <Button 
              className="bg-[#1B3A8C] hover:bg-[#0F2460] gap-2 px-8" 
              onClick={handleSaveRules}
              disabled={updateRule.isPending}
            >
              {updateRule.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Regras
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
