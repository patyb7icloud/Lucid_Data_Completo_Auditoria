import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Cpu, ArrowUpRight, TrendingDown } from "lucide-react";

export function FinOpsPanel() {
  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-emerald-600" />
          FinOps & Data ROI (Custo-Benefício de Armazenamento)
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <span className="text-[10px] text-gray-500 font-semibold uppercase">Custo Mensal Estimado</span>
            <p className="text-lg font-black text-slate-800 dark:text-white mt-0.5">$1,240.00</p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <span className="text-[10px] text-gray-500 font-semibold uppercase">Tabelas Ociosas/Orfãs</span>
            <p className="text-lg font-black text-amber-600 mt-0.5">4</p>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg">
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold uppercase">Potencial de Economia</span>
            <p className="text-lg font-black text-emerald-600 mt-0.5">$350/mês</p>
          </div>
        </div>

        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-2">
          <div className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded">
            <span>Tabelas não consultadas há mais de 90 dias</span>
            <Badge className="bg-amber-100 text-amber-800">Recomendado Arquivar</Badge>
          </div>
          <div className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded">
            <span>Tamanho total do catálogo analisado</span>
            <span className="font-semibold">2.4 TB</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function FinOpsAIPanel() {
  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Cpu className="h-4 w-4 text-purple-600" />
          IA FinOps & Otimização de Recursos (Modelos e Computação)
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-between">
            <div>
              <span className="text-[10px] text-gray-500 font-semibold uppercase">Eficiência de Consultas</span>
              <p className="text-lg font-black text-purple-600 mt-0.5">88%</p>
            </div>
            <ArrowUpRight className="h-5 w-5 text-purple-600" />
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-between">
            <div>
              <span className="text-[10px] text-gray-500 font-semibold uppercase">Otimização de Clusters</span>
              <p className="text-lg font-black text-emerald-600 mt-0.5">Ativo</p>
            </div>
            <TrendingDown className="h-5 w-5 text-emerald-600" />
          </div>
        </div>

        <p className="text-xs text-gray-500 leading-relaxed">
          O assistente de IA FinOps analisa continuamente o uso de CPU e memória dos clusters associados a esse catálogo para sugerir configurações ideais de auto-scaling.
        </p>
      </CardContent>
    </Card>
  );
}
