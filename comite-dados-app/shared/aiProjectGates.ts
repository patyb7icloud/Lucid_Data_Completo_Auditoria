export const AI_GATE_SEQUENCE = ["G0", "G1", "G2", "G3"] as const;
export type AiGate = (typeof AI_GATE_SEQUENCE)[number];

export type GateChecklistItem = {
  key: string;
  label: string;
};

const G0_EXIT: GateChecklistItem[] = [
  { key: "third_party_risk", label: "Validação de Fornecedor / Third-party Risk" },
  { key: "data_confidentiality", label: "Classificação da Confidencialidade dos dados" },
];

const G1_EXIT: Record<string, GateChecklistItem[]> = {
  "Engenharia de Dados": [
    { key: "data_dictionary_approved", label: "Dicionário de Dados aprovado" },
    { key: "lineage_documented", label: "Linhagem Documentada" },
    { key: "ingestion_pipeline_validated", label: "Pipeline de Ingestão Validado" },
  ],
  "Business Intelligence (BI)": [
    { key: "business_metrics_approved", label: "Homologação de Métricas com o Negócio" },
    { key: "ux_validated", label: "Layout UX/UI Validado" },
    { key: "dashboard_performance_tested", label: "Performance do Painel testada" },
  ],
  "Automação / RPA": [
    { key: "unit_tests_complete", label: "Testes Unitários Concluídos" },
    { key: "security_scan_complete", label: "Análise de Vulnerabilidades (SAST/DAST)" },
  ],
  "App / Software": [
    { key: "unit_tests_complete", label: "Testes Unitários Concluídos" },
    { key: "security_scan_complete", label: "Análise de Vulnerabilidades (SAST/DAST)" },
  ],
};

const G1_EXIT_AI: GateChecklistItem[] = [
  { key: "architecture_validated", label: "Arquitetura validada no Azure" },
  { key: "risk_reassessed", label: "Risco de IA Reavaliado" },
  { key: "mvp_approved", label: "MVP aprovado pelos stakeholders" },
  { key: "llm_red_team_complete", label: "Testes de Segurança de LLM (Jailbreak / Red Teaming)" },
  { key: "fairness_review_complete", label: "Avaliação de Viés (Fairness) aprovada" },
];

const G2_EXIT: Record<string, GateChecklistItem[]> = {
  "Engenharia de Dados": [
    { key: "quality_monitoring_active", label: "Monitoramento de Qualidade de Dados ativo" },
    { key: "access_policies_applied", label: "Políticas de Acesso de Dados aplicadas no Lake/DW" },
  ],
  "Business Intelligence (BI)": [
    { key: "scheduled_data_load", label: "Carga de dados agendada no Scheduler" },
    { key: "user_access_granted", label: "Acesso liberado para grupo de usuários finais" },
  ],
};

const G2_EXIT_DEFAULT: GateChecklistItem[] = [
  { key: "load_tests_complete", label: "Testes de Carga / Stress concluídos" },
  { key: "security_lgpd_policies_applied", label: "Políticas de Segurança e LGPD aplicadas no pipeline CI/CD" },
  { key: "observability_active", label: "Ferramentas de Observabilidade Ativas" },
  { key: "sla_escalation_defined", label: "Definição de SLA e Matriz de Escalonamento" },
  { key: "kill_switch_documented", label: "Mecanismo de Kill-switch documentado" },
];

/** Checklist version 1.0.0: target G1 means exiting G0, target G2 exiting G1, target G3 exiting G2. */
export function getRequiredChecklist(projectType: string, targetGate: AiGate): GateChecklistItem[] {
  if (targetGate === "G1") return G0_EXIT;
  if (targetGate === "G2") return G1_EXIT[projectType] ?? G1_EXIT_AI;
  if (targetGate === "G3") return G2_EXIT[projectType] ?? G2_EXIT_DEFAULT;
  return [];
}

export function getGateIndex(gate: string): number {
  return AI_GATE_SEQUENCE.indexOf(gate as AiGate);
}
