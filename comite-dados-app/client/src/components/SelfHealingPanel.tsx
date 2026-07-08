import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldCheck, Play, ArrowRight, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface SelfHealingPanelProps {
  schema: string;
  tableName: string;
}

export function SelfHealingPanel({ schema, tableName }: SelfHealingPanelProps) {
  const [analysis, setAnalysis] = useState<any>(null);
  const [isApplying, setIsApplying] = useState(false);

  const analyzeMutation = trpc.auditoria.selfHealing.analyzeTable.useMutation();
  const applyMutation = trpc.auditoria.selfHealing.applyFixes.useMutation();

  // Usar credenciais mockadas de Databricks para a simulação/execução do painel
  const handleAnalyze = async () => {
    try {
      const res = await analyzeMutation.mutateAsync({
        host: "https://mock-databricks.cloud.databricks.com",
        token: "dapi_mock_token_123",
        catalog: "main",
        schema,
        tableName,
      });
      setAnalysis(res);
      toast.success("Análise de auto-cura concluída!");
    } catch (e: any) {
      toast.error(`Falha ao analisar: ${e.message}`);
    }
  };

  const handleApply = async () => {
    if (!analysis || !analysis.suggestions) return;
    setIsApplying(true);
    try {
      await applyMutation.mutateAsync({
        host: "https://mock-databricks.cloud.databricks.com",
        token: "dapi_mock_token_123",
        catalog: "main",
        sqlCommands: analysis.suggestions.map((s: any) => s.sql),
      });
      toast.success("Correções aplicadas com sucesso!");
      setAnalysis(null);
    } catch (e: any) {
      toast.error(`Falha ao aplicar correções: ${e.message}`);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-purple-600" />
          Self-Healing (Auto-Cura de Metadados e Esquemas)
        </CardTitle>
        <Badge variant="outline" className="text-purple-600 border-purple-200">
          IA Assistente
        </Badge>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <p className="text-xs text-gray-500 leading-relaxed">
          Detecte e corrija automaticamente inconsistências ou colunas de tabelas do Databricks sem comentários ou sem tags de sensibilidade (PII).
        </p>

        {!analysis ? (
          <Button
            size="sm"
            onClick={handleAnalyze}
            disabled={analyzeMutation.isPending}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {analyzeMutation.isPending ? "Analisando..." : "Analisar Tabela para Auto-Cura"}
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 rounded-lg p-3">
              <h5 className="text-xs font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-purple-600" />
                {analysis.suggestions.length} Inconsistências Encontradas
              </h5>
              <div className="space-y-2 mt-2">
                {analysis.suggestions.map((s: any, idx: number) => (
                  <div key={idx} className="text-[11px] text-gray-600 dark:text-gray-400">
                    <p className="font-semibold text-gray-700 dark:text-gray-300">{s.description}</p>
                    <pre className="bg-slate-900 text-slate-200 p-2 rounded font-mono text-[10px] mt-1 overflow-x-auto">
                      {s.sql}
                    </pre>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleApply}
                disabled={isApplying}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isApplying ? "Aplicando..." : "Aplicar Correções Automáticas"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAnalysis(null)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
