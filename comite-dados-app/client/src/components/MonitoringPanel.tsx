import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Settings, Play, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface MonitoringPanelProps {
  tenantCatalog: string;
}

export function MonitoringPanel({ tenantCatalog }: MonitoringPanelProps) {
  const [metrics, setMetrics] = useState<any>(null);

  const getWeeklyMetricsQuery = trpc.monitoring.getWeeklyMetrics.useQuery(
    { tenantCatalog },
    { enabled: !!tenantCatalog }
  );

  const generateWeeklyMetricsMutation = trpc.monitoring.generateWeeklyMetrics.useMutation();
  const setupWeeklyJobMutation = trpc.monitoring.setupWeeklyJob.useMutation();

  const handleGenerate = async () => {
    try {
      const res = await generateWeeklyMetricsMutation.mutateAsync({ tenantCatalog });
      setMetrics(res);
      toast.success("Métricas semanais geradas com sucesso!");
    } catch (e: any) {
      toast.error(`Erro ao gerar métricas: ${e.message}`);
    }
  };

  const handleSetupJob = async () => {
    try {
      await setupWeeklyJobMutation.mutateAsync({ tenantCatalog });
      toast.success("Agendador semanal ativado no Databricks!");
    } catch (e: any) {
      toast.error(`Erro ao agendar: ${e.message}`);
    }
  };

  const activeMetrics = metrics || getWeeklyMetricsQuery.data;

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Eye className="h-4 w-4 text-blue-600" />
          Monitoramento Semanal de Auditoria e Qualidade
        </CardTitle>
        <Badge variant="outline" className="text-blue-600 border-blue-200">
          Relatórios
        </Badge>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <p className="text-xs text-gray-500 leading-relaxed">
          Monitore o progresso do catálogo {tenantCatalog} ao longo do tempo com relatórios e validações semanais.
        </p>

        {activeMetrics ? (
          <div className="grid grid-cols-2 gap-4 p-3 bg-blue-50/50 dark:bg-slate-800 rounded-lg text-xs">
            <div>
              <span className="text-[10px] text-gray-500 font-semibold uppercase">Total de Tabelas</span>
              <p className="text-base font-bold text-gray-800 dark:text-white mt-0.5">{activeMetrics.totalTables ?? 0}</p>
            </div>
            <div>
              <span className="text-[10px] text-gray-500 font-semibold uppercase">Qualidade Média</span>
              <p className="text-base font-bold text-gray-800 dark:text-white mt-0.5">{activeMetrics.averageQualityScore ?? 0}%</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">Sem relatórios semanais gerados recentemente.</p>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={generateWeeklyMetricsMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <RefreshCw size={13} className={`mr-1 ${generateWeeklyMetricsMutation.isPending ? "animate-spin" : ""}`} />
            Gerar Relatório Semanal
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSetupJob}
            disabled={setupWeeklyJobMutation.isPending}
          >
            <Settings size={13} className="mr-1" />
            Configurar Job Semanal
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
