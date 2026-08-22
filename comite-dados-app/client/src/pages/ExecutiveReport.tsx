import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, ShieldCheck, Database, FileCheck, Layers, Bot, TrendingUp, AlertTriangle, Settings, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function ExecutiveReport() {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [cronInput, setCronInput] = useState("0 2 * * *");
  
  const utils = trpc.useUtils();
  
  const { data: metrics, isLoading: isMetricsLoading } = trpc.executiveMetrics.getMetrics.useQuery();
  const { data: syncConfig, isLoading: isConfigLoading } = trpc.syncJob.getConfig.useQuery(undefined, {
    onSuccess: (data) => {
      if (data?.cronExpression) setCronInput(data.cronExpression);
    }
  });

  const updateConfig = trpc.syncJob.updateConfig.useMutation({
    onSuccess: () => {
      toast.success("Configuração de sincronização salva!");
      setIsConfigOpen(false);
    },
    onError: (err) => {
      toast.error("Erro ao salvar configuração: " + err.message);
    }
  });

  const triggerNow = trpc.syncJob.triggerNow.useMutation({
    onSuccess: () => {
      toast.success("Sincronização no Databricks concluída!");
      utils.executiveMetrics.getMetrics.invalidate();
      utils.syncJob.getConfig.invalidate();
    },
    onError: (err) => {
      toast.error("Erro na sincronização: " + err.message);
    }
  });

  if (isMetricsLoading || isConfigLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!metrics) {
    return <div>Erro ao carregar indicadores executivos.</div>;
  }

  const { catalog, access, intake, audit, aiGov } = metrics;
  
  const lastSyncFormatted = syncConfig?.lastSyncTime 
    ? new Date(syncConfig.lastSyncTime).toLocaleString("pt-BR")
    : "Nunca";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="h-8 w-8 text-primary" />
            Painel de Indicadores Executivos
          </h1>
          <p className="text-muted-foreground mt-2">
            Visão consolidada de Governança de Dados, Acessos, Demandas e AI TRiSM.
          </p>
        </div>

        <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configurar Sincronização
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sincronização Databricks</DialogTitle>
              <DialogDescription>
                Configure o horário em que o job varre o Unity Catalog para gerar os indicadores.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="cron">Expressão Cron de Agendamento</Label>
                <Input 
                  id="cron" 
                  value={cronInput}
                  onChange={(e) => setCronInput(e.target.value)}
                  placeholder="Ex: 0 2 * * *"
                />
                <p className="text-xs text-muted-foreground">
                  (Padrão: 0 2 * * * = todo dia às 2 da manhã)
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-md border text-sm space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-slate-700">Última Sincronização:</span>
                  <span className="text-slate-600">{lastSyncFormatted}</span>
                </div>
                
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="w-full mt-2 flex items-center gap-2"
                  onClick={() => triggerNow.mutate()}
                  disabled={triggerNow.isPending}
                >
                  {triggerNow.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Forçar Sincronização Agora (Varredura ao Vivo)
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsConfigOpen(false)}>Cancelar</Button>
              <Button 
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => updateConfig.mutate({ cronExpression: cronInput })}
                disabled={updateConfig.isPending}
              >
                {updateConfig.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salvar Configuração
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Bloco 1: Catálogo de Dados */}
        <Card className="border-t-4 border-t-blue-500 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Database className="h-5 w-5 text-blue-500" />
              Governança de Dados
            </CardTitle>
            <CardDescription>Métricas de catalogação e classificação</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <MetricProgress label="Ativos de Dados Catalogados" value={catalog.catalogedPercent} />
            <MetricProgress label="Ativos com Data Owner Definido" value={catalog.ownerDefinedPercent} />
            <MetricProgress label="Tabelas com Classificação MIP" value={catalog.mipClassificationPercent} />
            <MetricProgress label="Tabelas com Linhagem Documentada" value={catalog.lineageDocumentedPercent} />
          </CardContent>
        </Card>

        {/* Bloco 2: Governança de Acessos (Unity Catalog) */}
        <Card className="border-t-4 border-t-purple-500 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ShieldCheck className="h-5 w-5 text-purple-500" />
              Gestão de Acessos
            </CardTitle>
            <CardDescription>Conformidade e segurança no Unity Catalog</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {access.hasPermissionError ? (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-3 mb-2 flex items-start gap-2 text-sm">
                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                <p>
                  <strong>Sem Permissão no Databricks.</strong><br/>
                  O token atual não possui privilégios <code>USE CATALOG</code> no catálogo <code>system</code> do Unity Catalog. Contate o administrador para visualizar estas métricas reais.
                </p>
              </div>
            ) : null}
            <MetricProgress label="Acessos Recertificados no Período" value={access.hasPermissionError ? null : access.recertifiedPercent} />
            <MetricProgress label="Redução de Grants Diretos (Mês/Mês)" value={access.hasPermissionError ? null : access.directGrantsReduction} />
            <MetricProgress label="Acessos via Grupo/Service Principal" value={access.spnGroupGrantedPercent} />
            <MetricProgress label="Privilégios MANAGE/ALL Revisados" value={access.hasPermissionError ? null : access.manageAllPrivilegesReviewed} />
          </CardContent>
        </Card>

        {/* Bloco 3: Gestão de Demandas (Intake) */}
        <Card className="border-t-4 border-t-indigo-500 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Layers className="h-5 w-5 text-indigo-500" />
              Projetos & Demandas
            </CardTitle>
            <CardDescription>Maturidade no funil de Intake</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <MetricProgress label="Projetos com Formulário Completo" value={intake.mandatoryFormPercent} />
            <MetricProgress label="MIP, Owner e Risco Informados" value={intake.mipOwnerRiskPercent} />
            <MetricProgress label="Aprovação na 1ª Revisão do Comitê" value={intake.firstReviewApprovalRate} />
            
            <div className="pt-2 flex items-center justify-between bg-indigo-50 p-3 rounded-md">
              <span className="text-sm font-medium text-indigo-900">SLA Médio de Preenchimento/Validação</span>
              <span className="text-lg font-bold text-indigo-700">{intake.avgFillValidationDays} dias</span>
            </div>
          </CardContent>
        </Card>

        {/* Bloco 4: Auditoria e Evidências */}
        <Card className="border-t-4 border-t-orange-500 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <FileCheck className="h-5 w-5 text-orange-500" />
              Auditoria & Evidências
            </CardTitle>
            <CardDescription>Resolução de gaps e conformidade contínua</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <MetricProgress label="Projetos com Evidências Completas" value={audit.completeEvidencePercent} />
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-orange-50 p-3 rounded-md flex flex-col items-center text-center">
                <span className="text-2xl font-bold text-orange-700">{audit.avgTimeToFindOwnerDays}d</span>
                <span className="text-xs font-medium text-orange-900 mt-1">Tempo médio p/ localizar Owner/Acesso</span>
              </div>
              <div className="bg-orange-50 p-3 rounded-md flex flex-col items-center text-center">
                <span className="text-2xl font-bold text-orange-700">{audit.avgResolutionDays}d</span>
                <span className="text-xs font-medium text-orange-900 mt-1">Prazo de resolução de achados</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between border-t pt-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">Média de Não Conformidades/Ciclo</span>
              </div>
              <span className="font-bold text-lg">{audit.avgNonCompliancesPerCycle}</span>
            </div>
          </CardContent>
        </Card>

        {/* Bloco 5: Governança de IA (AI TRiSM) */}
        <Card className="border-t-4 border-t-teal-500 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Bot className="h-5 w-5 text-teal-500" />
              Governança de IA (AI TRiSM)
            </CardTitle>
            <CardDescription>Riscos, Modelos e Equidade algorítmica</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            <MetricProgress label="Iniciativas Classificadas por Risco" value={aiGov.riskClassifiedPercent} />
            <MetricProgress label="Casos P1/P2 com Gate Concluído" value={aiGov.p1p2GatesCompletedPercent} />
            <MetricProgress label="Modelos com Owner e Linhagem Dado/Modelo" value={aiGov.modelDataLineagePercent} />
            <MetricProgress label="Modelos com Cobertura de Testes de Equidade" value={aiGov.fairnessTestsCoveragePercent} />
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

function MetricProgress({ label, value }: { label: string; value: number | null }) {
  // Cor dinâmica baseada no percentual
  const getColor = (v: number | null) => {
    if (v === null) return "bg-gray-300";
    if (v >= 90) return "bg-green-500";
    if (v >= 70) return "bg-blue-500";
    if (v >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-sm font-medium">
        <span>{label}</span>
        <span className={value === null ? "text-gray-400 font-normal italic" : "text-muted-foreground"}>
          {value === null ? "N/D" : `${value}%`}
        </span>
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-1000 ease-out ${getColor(value)}`} 
          style={{ width: value === null ? '100%' : `${value}%` }}
        />
      </div>
    </div>
  );
}
