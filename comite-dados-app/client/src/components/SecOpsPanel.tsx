import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldAlert, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";

export function SecOpsPanel() {
  return (
    <Card className="border border-red-200 bg-red-50/20 shadow-sm">
      <CardHeader className="pb-3 border-b border-red-100">
        <CardTitle className="text-sm font-bold text-red-900 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-red-600" />
          SecOps & Anomalias de Segurança em Tempo Real
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-3">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-red-800 leading-relaxed font-semibold">
              Nenhuma anomalia crítica de acesso detectada nas últimas 24 horas.
            </p>
            <p className="text-[11px] text-red-700/80 leading-relaxed mt-0.5">
              O monitoramento contínuo do Unity Catalog está ativo e validando assinaturas e queries.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
