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
  const [isRegexOpen, setIsRegexOpen] = useState(false);
  const [historyAssetId, setHistoryAssetId] = useState<number | null>(null);
  
  // Regras temporárias para o modal
  const [compThreshold, setCompThreshold] = useState(95);
  const [uniqThreshold, setUniqThreshold] = useState(100);

  // Regex rules
  const [regexColumn, setRegexColumn] = useState("");
  const [regexPattern, setRegexPattern] = useState("");
  const [regexThreshold, setRegexThreshold] = useState(99);

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
    
    // Reset or load from existingRules
    setCompThreshold(95);
    setUniqThreshold(100);
    
    setIsConfigOpen(true);
  };

  const handleViewHistory = (asset: any) => {
    setHistoryAssetId(asset.id);
  };

  useEffect(() => {
    if (existingRules) {
      const compRule = existingRules.find(r => r.ruleType === 'completude');
      const uniqRule = existingRules.find(r => r.ruleType === 'unicidade');
      const regexRule = existingRules.find(r => r.ruleType === 'regex');

      if (compRule) setCompThreshold(compRule.threshold ?? 95);
      if (uniqRule) setUniqThreshold(uniqRule.threshold ?? 100);
      if (regexRule) {
        setRegexColumn(regexRule.columnName || "");
        setRegexPattern(regexRule.customPattern || "");
        setRegexThreshold(regexRule.threshold ?? 99);
      }
    }
  }, [existingRules]);

  const handleSaveRules = async () => {
    if (!selectedAsset) return;
    
    // Salva regra de completude
    await updateRule.mutateAsync({
      assetId: selectedAsset.id,
      ruleType: 'completude',
      threshold: compThreshold
    });

    // Salva regra de unicidade
    await updateRule.mutateAsync({
      assetId: selectedAsset.id,
      ruleType: 'unicidade',
      threshold: uniqThreshold
    });

    setIsConfigOpen(false);
  };

  const handleSaveRegex = async () => {
    if (!selectedAsset || !regexPattern || !regexColumn) return;

    try {
      await updateRule.mutateAsync({
        assetId: selectedAsset.id,
        ruleType: 'regex',
        columnName: regexColumn,
        customPattern: regexPattern,
        threshold: regexThreshold
      });
      toast.success("Regra Regex salva com sucesso!");
      setIsRegexOpen(false);
    } catch (err) {
      toast.error("Erro ao salvar regra Regex");
    }
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
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg text-blue-700">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">Completude Mínima</p>
                    <p className="text-[10px] text-gray-500">Mínimo aceitável de campos preenchidos.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input 
                    type="number" 
                    value={compThreshold} 
                    onChange={(e) => setCompThreshold(Number(e.target.value))}
                    className="w-16 h-8 text-center font-bold border-gray-200" 
                  />
                  <span className="text-sm font-bold text-gray-400">%</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg text-green-700">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">Unicidade de Chave</p>
                    <p className="text-[10px] text-gray-500">Meta de registros únicos para chaves primárias.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input 
                    type="number" 
                    value={uniqThreshold} 
                    onChange={(e) => setUniqThreshold(Number(e.target.value))}
                    className="w-16 h-8 text-center font-bold border-gray-200" 
                  />
                  <span className="text-sm font-bold text-gray-400">%</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg text-amber-700">
                    <Regex className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">Validação Customizada (Regex)</p>
                    <p className="text-[10px] text-gray-500">Padrão: {regexPattern || 'Nenhum'}</p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-blue-600 text-[10px] font-bold uppercase hover:bg-blue-50"
                  onClick={() => setIsRegexOpen(true)}
                >
                  {regexPattern ? 'Editar Regex' : 'Configurar Regex'}
                </Button>
              </div>
            </div>

            <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex gap-3">
              <Info className="h-5 w-5 text-blue-600 shrink-0" />
              <p className="text-[11px] text-blue-800 leading-relaxed">
                <strong>Nota Técnica:</strong> O motor de qualidade do Lucid Data Governance utiliza estas metas para calcular o <strong>Quality Score</strong> exibido no Catálogo Principal.
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

      {/* Modal de Regex */}
      <Dialog open={isRegexOpen} onOpenChange={setIsRegexOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#1B3A8C]">
              <Regex className="h-5 w-5" /> Expressão Regular
            </DialogTitle>
            <DialogDescription>
              Valide formatos específicos (CPF, E-mail, SKU SAP) via Regex.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-gray-400">Coluna Alvo</label>
              <Input 
                placeholder="Ex: email_contato, cod_sap" 
                value={regexColumn}
                onChange={(e) => setRegexColumn(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-gray-400">Padrão Regex</label>
              <Input 
                placeholder="Ex: ^[a-z0-9]+@[a-z]+\.[a-z]{2,3}$" 
                className="font-mono text-xs"
                value={regexPattern}
                onChange={(e) => setRegexPattern(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-gray-400">Threshold de Aceitação (%)</label>
              <Input 
                type="number"
                value={regexThreshold}
                onChange={(e) => setRegexThreshold(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsRegexOpen(false)}>Cancelar</Button>
            <Button className="bg-blue-600" onClick={handleSaveRegex}>Aplicar Padrão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
