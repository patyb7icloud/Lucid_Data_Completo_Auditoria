import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

// Types from lgpd-compliance.ts
export interface LGPDAnalysis {
  summary: {
    complianceScore: number;
    riskLevel: "critical" | "high" | "medium" | "low";
    criticalIssues: number;
    highRiskAssets: number;
    lastUpdated: string;
  };
  piiDetection: {
    totalColumns: number;
    piiColumnsIdentified: number;
    piiTagged: number;
    untaggedPiiRisk: number;
    categories: Array<{ name: string; count: number; samples: string[] }>;
  };
  dataMinimization: {
    assessment: "compliant" | "partial" | "noncompliant";
    unnecessaryColumns: string[];
    recommendations: string[];
  };
  retention: {
    assessment: "defined" | "partial" | "undefined";
    policies: Array<{
      table: string;
      retentionDays?: number;
      deletePolicy?: string;
      assessment: "defined" | "undefined";
    }>;
    gaps: string[];
  };
  consent: {
    assessment: "tracked" | "partial" | "untracked";
    consentFields: string[];
    missingSources: string[];
  };
  encryption: {
    assessment: "enabled" | "partial" | "disabled";
    encryptedTables: number;
    unencryptedTables: number;
    recommendations: string[];
  };
  audit: {
    accessLogsEnabled: boolean;
    logRetention: number;
    lastAuditDate?: string;
    accessEvents: number;
  };
  dsr: {
    readyForDSR: boolean;
    readyForDeletion: boolean;
    readyForExport: boolean;
    gaps: string[];
  };
  responsibilities: {
    dataController: string;
    dataProcessor?: string;
    dpo?: string;
    owner: string;
  };
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const GOLD = "#D4A017";
const DARK = "#0D0D0D";
const DARK2 = "#1A1A1A";
const DARK3 = "#242424";
const LIGHT = "#F5F0E8";
const MUTED = "#8A8070";
const SUCCESS = "#22C55E";
const WARNING = "#F59E0B";
const DANGER = "#EF4444";
const INFO = "#3B82F6";
const WHITE = "#FFFFFF";
const PURPLE = "#A78BFA";

const styles = StyleSheet.create({
  page: {
    backgroundColor: DARK,
    fontFamily: "Helvetica",
    paddingBottom: 40,
  },
  sectionPage: {
    backgroundColor: DARK,
    padding: 40,
  },
  sectionHeader: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: DARK3,
  },
  sectionHeaderAccent: {
    width: 4,
    height: 20,
    backgroundColor: GOLD,
    borderRadius: 2,
    marginRight: 10,
  },
  sectionTitle: {
    color: WHITE,
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
  },
  sectionSubtitle: {
    color: MUTED,
    fontSize: 9,
    marginTop: 2,
  },
  riskScoreBanner: {
    backgroundColor: DARK2,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    display: "flex",
    flexDirection: "row",
    gap: 24,
    borderWidth: 1,
    borderColor: DARK3,
  },
  riskScoreBox: {
    alignItems: "center",
  },
  riskScoreValue: {
    fontSize: 48,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1,
  },
  riskScoreLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
    marginTop: 4,
    color: MUTED,
  },
  riskBadge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 8,
  },
  riskBadgeText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
  },
  metricsGrid: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    width: "31%",
    backgroundColor: DARK2,
    borderRadius: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: DARK3,
  },
  metricValue: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1,
  },
  metricLabel: {
    fontSize: 7,
    color: MUTED,
    marginTop: 4,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
  },
  assessmentCard: {
    backgroundColor: DARK2,
    borderRadius: 6,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: DARK3,
  },
  assessmentTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: GOLD,
    marginBottom: 8,
  },
  assessmentRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  assessmentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  assessmentText: {
    fontSize: 9,
    color: LIGHT,
    flex: 1,
  },
  assessmentStatus: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  gapItem: {
    backgroundColor: DARK2,
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: WARNING,
  },
  gapText: {
    fontSize: 8,
    color: LIGHT,
    lineHeight: 1.4,
  },
  checklist: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  checklistItem: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 8,
    backgroundColor: DARK2,
    borderRadius: 4,
  },
  checklistDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  checklistDotText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: WHITE,
  },
  checklistLabel: {
    fontSize: 9,
    flex: 1,
  },
  infoBox: {
    backgroundColor: DARK2,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: DARK3,
    marginBottom: 12,
  },
  infoBoxTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: GOLD,
    marginBottom: 8,
    letterSpacing: 0.8,
  },
  infoBoxText: {
    fontSize: 9,
    color: LIGHT,
    lineHeight: 1.5,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: DARK3,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: MUTED,
  },
  footerAccent: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: GOLD,
  },
  twoCol: {
    display: "flex",
    flexDirection: "row",
    gap: 16,
  },
  col: {
    flex: 1,
  },
  colTitle: {
    color: WHITE,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: DARK3,
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRiskColor(riskLevel: string): string {
  switch (riskLevel) {
    case "critical":
      return DANGER;
    case "high":
      return WARNING;
    case "medium":
      return "#F97316";
    case "low":
      return SUCCESS;
    default:
      return MUTED;
  }
}

function getRiskLabel(riskLevel: string): string {
  switch (riskLevel) {
    case "critical":
      return "CRÍTICO";
    case "high":
      return "ALTO";
    case "medium":
      return "MÉDIO";
    case "low":
      return "BAIXO";
    default:
      return "DESCONHECIDO";
  }
}

function getAssessmentColor(assessment: string): string {
  switch (assessment) {
    case "enabled":
    case "defined":
    case "tracked":
    case "compliant":
      return SUCCESS;
    case "partial":
      return WARNING;
    case "disabled":
    case "undefined":
    case "untracked":
    case "noncompliant":
      return DANGER;
    default:
      return MUTED;
  }
}

function getAssessmentLabel(assessment: string): string {
  const labels: Record<string, string> = {
    enabled: "ATIVO",
    disabled: "DESATIVO",
    defined: "DEFINIDO",
    partial: "PARCIAL",
    undefined: "INDEFINIDO",
    tracked: "RASTREADO",
    untracked: "NÃO RASTREADO",
    compliant: "CONFORME",
    noncompliant: "NÃO CONFORME",
  };
  return labels[assessment] || assessment.toUpperCase();
}

function Footer({ catalog, date }: { catalog: string; date: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>
        Databricks Governance Tool · Compliance LGPD/GDPR
      </Text>
      <Text style={styles.footerText}>{date}</Text>
    </View>
  );
}

// ─── PDF Document ─────────────────────────────────────────────────────────────

export function LGPDCompliancePdfPage({
  analysis,
  catalog,
  date,
}: {
  analysis: LGPDAnalysis;
  catalog: string;
  date: string;
}) {
  const dateStr = new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const riskColor = getRiskColor(analysis.summary.riskLevel);

  return (
    <Document
      title={`Relatório de Compliance LGPD — ${catalog}`}
      author="Databricks Governance Tool"
      subject="Auditoria de Compliance LGPD/GDPR"
    >
      {/* ── PÁGINA 1: COMPLIANCE OVERVIEW ── */}
      <Page size="A4" style={styles.sectionPage}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderAccent} />
          <View>
            <Text style={styles.sectionTitle}>Compliance LGPD/GDPR</Text>
            <Text style={styles.sectionSubtitle}>
              Análise de conformidade com Lei Geral de Proteção de Dados
            </Text>
          </View>
        </View>

        {/* Risk Score Banner */}
        <View style={styles.riskScoreBanner}>
          <View style={styles.riskScoreBox}>
            <Text style={[styles.riskScoreValue, { color: riskColor }]}>
              {analysis.summary.complianceScore}
            </Text>
            <Text style={styles.riskScoreLabel}>COMPLIANCE SCORE</Text>
            <View
              style={[
                styles.riskBadge,
                { backgroundColor: riskColor + "22" },
              ]}
            >
              <Text
                style={[styles.riskBadgeText, { color: riskColor }]}
              >
                {getRiskLabel(analysis.summary.riskLevel)}
              </Text>
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <Text style={[styles.metricValue, { color: DANGER }]}>
                  {analysis.summary.criticalIssues}
                </Text>
                <Text style={styles.metricLabel}>PROBLEMAS CRÍTICOS</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={[styles.metricValue, { color: WARNING }]}>
                  {analysis.summary.highRiskAssets}
                </Text>
                <Text style={styles.metricLabel}>ATIVOS EM RISCO</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={[styles.metricValue, { color: INFO }]}>
                  {analysis.piiDetection.piiColumnsIdentified}
                </Text>
                <Text style={styles.metricLabel}>COLUNAS PII</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Responsabilidades */}
        <View style={styles.infoBox}>
          <Text style={styles.infoBoxTitle}>RESPONSABILIDADES LGPD</Text>
          <Text style={styles.infoBoxText}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Controlador:</Text>{" "}
            {analysis.responsibilities.dataController}
            {"\n"}
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Processador:</Text>{" "}
            {analysis.responsibilities.dataProcessor || "—"}
            {"\n"}
            <Text style={{ fontFamily: "Helvetica-Bold" }}>
              Oficial de Proteção de Dados (DPO):
            </Text>{" "}
            {analysis.responsibilities.dpo || "Não designado"}
          </Text>
        </View>

        <Footer catalog={catalog} date={dateStr} />
      </Page>

      {/* ── PÁGINA 2: PII & DATA MINIMIZATION ── */}
      <Page size="A4" style={styles.sectionPage}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderAccent} />
          <View>
            <Text style={styles.sectionTitle}>Proteção de Dados Pessoais</Text>
            <Text style={styles.sectionSubtitle}>
              Identificação de PII e minimização de dados
            </Text>
          </View>
        </View>

        {/* PII Detection */}
        <View style={[styles.assessmentCard, { marginBottom: 16 }]}>
          <Text style={styles.assessmentTitle}>DETECÇÃO DE PII</Text>
          <View style={styles.assessmentRow}>
            <Text style={styles.assessmentText}>Total de Colunas</Text>
            <Text style={[styles.metricValue, { color: GOLD, fontSize: 18 }]}>
              {analysis.piiDetection.totalColumns}
            </Text>
          </View>
          <View style={styles.assessmentRow}>
            <Text style={styles.assessmentText}>
              Colunas PII Identificadas
            </Text>
            <Text style={[styles.metricValue, { color: INFO, fontSize: 18 }]}>
              {analysis.piiDetection.piiColumnsIdentified}
            </Text>
          </View>
          <View style={styles.assessmentRow}>
            <Text style={styles.assessmentText}>PII Etiquetado</Text>
            <Text style={[styles.metricValue, { color: SUCCESS, fontSize: 18 }]}>
              {analysis.piiDetection.piiTagged}
            </Text>
          </View>
          <View
            style={[
              styles.assessmentRow,
              {
                borderTopWidth: 1,
                borderTopColor: DARK3,
                paddingTop: 8,
                marginTop: 8,
              },
            ]}
          >
            <Text style={[styles.assessmentText, { color: DANGER }]}>
              PII Não Etiquetado (Risco)
            </Text>
            <Text
              style={[styles.metricValue, { color: DANGER, fontSize: 18 }]}
            >
              {analysis.piiDetection.untaggedPiiRisk}
            </Text>
          </View>
        </View>

        {/* PII Categories */}
        {analysis.piiDetection.categories.length > 0 && (
          <View style={[styles.assessmentCard, { marginBottom: 16 }]}>
            <Text style={styles.assessmentTitle}>CATEGORIAS DE PII</Text>
            {analysis.piiDetection.categories.map((cat, i) => (
              <View key={i} style={styles.assessmentRow}>
                <View
                  style={[
                    styles.assessmentDot,
                    { backgroundColor: PURPLE },
                  ]}
                />
                <Text style={styles.assessmentText}>
                  {cat.name}: {cat.count} colunas
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Data Minimization */}
        <View style={styles.assessmentCard}>
          <Text style={styles.assessmentTitle}>MINIMIZAÇÃO DE DADOS</Text>
          <View style={styles.assessmentRow}>
            <View
              style={[
                styles.assessmentDot,
                {
                  backgroundColor: getAssessmentColor(
                    analysis.dataMinimization.assessment
                  ),
                },
              ]}
            />
            <Text style={styles.assessmentText}>
              Avaliação de minimização
            </Text>
            <Text
              style={[
                styles.assessmentStatus,
                {
                  backgroundColor:
                    getAssessmentColor(
                      analysis.dataMinimization.assessment
                    ) + "33",
                  color: getAssessmentColor(
                    analysis.dataMinimization.assessment
                  ),
                },
              ]}
            >
              {getAssessmentLabel(analysis.dataMinimization.assessment)}
            </Text>
          </View>
          {analysis.dataMinimization.unnecessaryColumns.length > 0 && (
            <>
              <Text
                style={[
                  styles.assessmentText,
                  {
                    marginTop: 8,
                    fontFamily: "Helvetica-Bold",
                    fontSize: 8,
                  },
                ]}
              >
                Colunas Desnecessárias Identificadas:
              </Text>
              {analysis.dataMinimization.unnecessaryColumns
                .slice(0, 5)
                .map((col, i) => (
                  <Text
                    key={i}
                    style={[styles.assessmentText, { fontSize: 7, color: MUTED }]}
                  >
                    • {col}
                  </Text>
                ))}
            </>
          )}
        </View>

        <Footer catalog={catalog} date={dateStr} />
      </Page>

      {/* ── PÁGINA 3: RETENTION & ENCRYPTION ── */}
      <Page size="A4" style={styles.sectionPage}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderAccent} />
          <View>
            <Text style={styles.sectionTitle}>Retenção & Segurança</Text>
            <Text style={styles.sectionSubtitle}>
              Políticas de retenção de dados e criptografia
            </Text>
          </View>
        </View>

        {/* Data Retention */}
        <View style={[styles.assessmentCard, { marginBottom: 16 }]}>
          <Text style={styles.assessmentTitle}>POLÍTICAS DE RETENÇÃO</Text>
          <View style={styles.assessmentRow}>
            <View
              style={[
                styles.assessmentDot,
                {
                  backgroundColor: getAssessmentColor(analysis.retention.assessment),
                },
              ]}
            />
            <Text style={styles.assessmentText}>Status de Retenção</Text>
            <Text
              style={[
                styles.assessmentStatus,
                {
                  backgroundColor:
                    getAssessmentColor(analysis.retention.assessment) + "33",
                  color: getAssessmentColor(analysis.retention.assessment),
                },
              ]}
            >
              {getAssessmentLabel(analysis.retention.assessment)}
            </Text>
          </View>
          {analysis.retention.gaps.length > 0 && (
            <>
              <Text
                style={[
                  styles.assessmentText,
                  {
                    marginTop: 8,
                    fontFamily: "Helvetica-Bold",
                    fontSize: 8,
                  },
                ]}
              >
                Gaps:
              </Text>
              {analysis.retention.gaps.map((gap, i) => (
                <Text
                  key={i}
                  style={[styles.gapText, { marginLeft: 12 }]}
                >
                  • {gap}
                </Text>
              ))}
            </>
          )}
        </View>

        {/* Encryption */}
        <View style={styles.assessmentCard}>
          <Text style={styles.assessmentTitle}>CRIPTOGRAFIA</Text>
          <View style={styles.assessmentRow}>
            <View
              style={[
                styles.assessmentDot,
                {
                  backgroundColor: getAssessmentColor(analysis.encryption.assessment),
                },
              ]}
            />
            <Text style={styles.assessmentText}>Status de Criptografia</Text>
            <Text
              style={[
                styles.assessmentStatus,
                {
                  backgroundColor:
                    getAssessmentColor(analysis.encryption.assessment) + "33",
                  color: getAssessmentColor(analysis.encryption.assessment),
                },
              ]}
            >
              {getAssessmentLabel(analysis.encryption.assessment)}
            </Text>
          </View>
          <View style={styles.assessmentRow}>
            <Text style={styles.assessmentText}>Tabelas Criptografadas</Text>
            <Text style={[styles.metricValue, { color: SUCCESS, fontSize: 16 }]}>
              {analysis.encryption.encryptedTables}
            </Text>
          </View>
          <View style={styles.assessmentRow}>
            <Text style={styles.assessmentText}>Tabelas Sem Criptografia</Text>
            <Text
              style={[
                styles.metricValue,
                {
                  color:
                    analysis.encryption.unencryptedTables > 5 ? DANGER : WARNING,
                  fontSize: 16,
                },
              ]}
            >
              {analysis.encryption.unencryptedTables}
            </Text>
          </View>
        </View>

        <Footer catalog={catalog} date={dateStr} />
      </Page>

      {/* ── PÁGINA 4: AUDIT LOGS & DSR READINESS ── */}
      <Page size="A4" style={styles.sectionPage}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderAccent} />
          <View>
            <Text style={styles.sectionTitle}>Auditoria & Direitos</Text>
            <Text style={styles.sectionSubtitle}>
              Logs de acesso e prontidão para direitos de dados
            </Text>
          </View>
        </View>

        {/* Audit Logs */}
        <View style={[styles.assessmentCard, { marginBottom: 16 }]}>
          <Text style={styles.assessmentTitle}>LOGS DE ACESSO</Text>
          <View style={styles.assessmentRow}>
            <View
              style={[
                styles.assessmentDot,
                {
                  backgroundColor: analysis.audit.accessLogsEnabled
                    ? SUCCESS
                    : DANGER,
                },
              ]}
            />
            <Text style={styles.assessmentText}>Logging de Acesso</Text>
            <Text
              style={[
                styles.assessmentStatus,
                {
                  backgroundColor: analysis.audit.accessLogsEnabled
                    ? SUCCESS + "33"
                    : DANGER + "33",
                  color: analysis.audit.accessLogsEnabled ? SUCCESS : DANGER,
                },
              ]}
            >
              {analysis.audit.accessLogsEnabled ? "ATIVO" : "DESATIVO"}
            </Text>
          </View>
          {analysis.audit.accessLogsEnabled && (
            <>
              <View style={styles.assessmentRow}>
                <Text style={styles.assessmentText}>Retenção de Logs (dias)</Text>
                <Text style={[styles.metricValue, { color: GOLD, fontSize: 16 }]}>
                  {analysis.audit.logRetention}
                </Text>
              </View>
              <View style={styles.assessmentRow}>
                <Text style={styles.assessmentText}>Eventos Registrados</Text>
                <Text style={[styles.metricValue, { color: INFO, fontSize: 16 }]}>
                  {analysis.audit.accessEvents}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Data Subject Rights */}
        <View style={styles.assessmentCard}>
          <Text style={styles.assessmentTitle}>DIREITOS DO TITULAR DOS DADOS (DSR)</Text>
          <View
            style={[
              styles.twoCol,
              { display: "flex", flexDirection: "column", gap: 8 },
            ]}
          >
            {[
              { key: "readyForDSR", label: "Pronto para Acesso (DSR)" },
              { key: "readyForExport", label: "Pronto para Exportação" },
              { key: "readyForDeletion", label: "Pronto para Exclusão" },
            ].map(({ key, label }) => (
              <View key={key} style={styles.assessmentRow}>
                <View
                  style={[
                    styles.assessmentDot,
                    {
                      backgroundColor: analysis.dsr[
                        key as keyof typeof analysis.dsr
                      ]
                        ? SUCCESS
                        : DANGER,
                    },
                  ]}
                />
                <Text style={styles.assessmentText}>{label}</Text>
                <Text
                  style={[
                    styles.assessmentStatus,
                    {
                      backgroundColor: analysis.dsr[
                        key as keyof typeof analysis.dsr
                      ]
                        ? SUCCESS + "33"
                        : DANGER + "33",
                      color: analysis.dsr[key as keyof typeof analysis.dsr]
                        ? SUCCESS
                        : DANGER,
                    },
                  ]}
                >
                  {analysis.dsr[key as keyof typeof analysis.dsr]
                    ? "PRONTO"
                    : "NÃO PRONTO"}
                </Text>
              </View>
            ))}
          </View>

          {analysis.dsr.gaps.length > 0 && (
            <>
              <Text
                style={[
                  styles.assessmentText,
                  {
                    marginTop: 8,
                    fontFamily: "Helvetica-Bold",
                    fontSize: 8,
                  },
                ]}
              >
                Gaps na Prontidão:
              </Text>
              {analysis.dsr.gaps.map((gap, i) => (
                <Text key={i} style={[styles.gapText, { marginLeft: 12 }]}>
                  • {gap}
                </Text>
              ))}
            </>
          )}
        </View>

        <Footer catalog={catalog} date={dateStr} />
      </Page>
    </Document>
  );
}
