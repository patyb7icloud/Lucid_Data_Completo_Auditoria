import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Shield, ShieldAlert, ShieldCheck, CheckCircle2, Lock, Eye, AlertCircle } from "lucide-react";
import { getTranslation } from "@shared/i18n/translations";

interface LGPDCompliancePanelProps {
  score: number;
  riskLevel: "critical" | "high" | "medium" | "low";
  criticalIssues: number;
  piiColumnsUntagged: number;
  retentionPolicies: number;
  encryptedTables: number;
  auditLogsEnabled: boolean;
  dsrReadiness: {
    export: boolean;
    delete: boolean;
    access: boolean;
  };
  recommendations: any[];
  language: "pt" | "en";
}

export function LGPDCompliancePanel({
  score,
  riskLevel,
  criticalIssues,
  piiColumnsUntagged,
  retentionPolicies,
  encryptedTables,
  auditLogsEnabled,
  dsrReadiness,
  recommendations,
  language,
}: LGPDCompliancePanelProps) {
  const t = getTranslation(language);

  return (
    <div className="space-y-6">
      {/* Score Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 flex flex-col items-center justify-center">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            {t.compliance.score}
          </h3>
          <div className="relative w-32 h-32 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" strokeWidth="8" />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={score >= 80 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444"}
                strokeWidth="8"
                strokeDasharray={2 * Math.PI * 40}
                strokeDashoffset={2 * Math.PI * 40 - (2 * Math.PI * 40 * score) / 100}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">{score}%</span>
            </div>
          </div>
        </Card>

        <Card className="p-6 md:col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Resumo de Conformidade
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <span className="text-xs text-gray-500">Nível de Risco</span>
              <p className={`text-lg font-bold uppercase mt-1 ${
                riskLevel === "critical" || riskLevel === "high" ? "text-red-600" : "text-green-600"
              }`}>
                {riskLevel}
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <span className="text-xs text-gray-500">Colunas PII sem Tag</span>
              <p className="text-lg font-bold text-orange-600 mt-1">{piiColumnsUntagged}</p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <span className="text-xs text-gray-500">Políticas de Retenção</span>
              <p className="text-lg font-bold text-blue-600 mt-1">{retentionPolicies}</p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <span className="text-xs text-gray-500">Tabelas Criptografadas</span>
              <p className="text-lg font-bold text-green-600 mt-1">{encryptedTables}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* DSR Readiness & Safeguards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              Prontidão DSR (Data Subject Rights)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-3">
            {[
              { label: "Direito de Acesso", status: dsrReadiness.access },
              { label: "Direito de Portabilidade/Exportação", status: dsrReadiness.export },
              { label: "Direito de Exclusão/Esquecimento", status: dsrReadiness.delete },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.label}</span>
                <Badge className={item.status ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                  {item.status ? "Pronto" : "Incompleto"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="p-6">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Lock className="h-5 w-5 text-blue-600" />
              Controles e Auditoria
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Logs de Acesso</p>
                <p className="text-xs text-gray-500">Registro de leitura de dados pessoais</p>
              </div>
              <Badge className={auditLogsEnabled ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                {auditLogsEnabled ? "Ativado" : "Desativado"}
              </Badge>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
              <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed font-semibold">
                Dica de Governança:
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed mt-0.5">
                Revise as políticas pendentes na aba "Recomendações" para aumentar o score de governança e garantir conformidade com a LGPD.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
