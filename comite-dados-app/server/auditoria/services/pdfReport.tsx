import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PdfReportData {
  metadata: {
    databricksHost: string;
    targetCatalog: string;
    auditDate: string | Date;
    governanceScore: number;
  };
  summary: {
    totalCatalogs: number;
    totalSchemas: number;
    totalTables: number;
    docCoverage: number;
    tagCoverage: number;
    totalGrants: number;
    lineageEdges: number;
    securityFunctions: number;
  };
  breakdown: Record<string, number>;
  gaps: string[];
  recommendations: string[];
  bestPractices: Array<{ label: string; passed: boolean; detail: string }>;
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

const styles = StyleSheet.create({
  page: {
    backgroundColor: DARK,
    fontFamily: "Helvetica",
    paddingBottom: 40,
  },
  // ── Cover ──
  coverPage: {
    backgroundColor: DARK,
    padding: 0,
    display: "flex",
    flexDirection: "column",
  },
  coverTopBar: {
    backgroundColor: GOLD,
    height: 6,
    width: "100%",
  },
  coverContent: {
    flex: 1,
    padding: 56,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  coverBadge: {
    backgroundColor: DARK3,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
    marginBottom: 32,
  },
  coverBadgeText: {
    color: GOLD,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2,
  },
  coverTitle: {
    color: WHITE,
    fontSize: 36,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1.2,
    marginBottom: 8,
  },
  coverTitleAccent: {
    color: GOLD,
    fontSize: 36,
    fontFamily: "Helvetica-Bold",
  },
  coverSubtitle: {
    color: MUTED,
    fontSize: 13,
    marginTop: 12,
    lineHeight: 1.5,
  },
  coverDivider: {
    height: 1,
    backgroundColor: DARK3,
    marginVertical: 32,
  },
  coverMeta: {
    display: "flex",
    flexDirection: "row",
    gap: 32,
  },
  coverMetaItem: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  coverMetaLabel: {
    color: MUTED,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.5,
  },
  coverMetaValue: {
    color: LIGHT,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
  },
  coverScoreBox: {
    backgroundColor: DARK3,
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: GOLD + "33",
    alignSelf: "flex-start",
  },
  coverScoreNumber: {
    color: GOLD,
    fontSize: 56,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1,
  },
  coverScoreLabel: {
    color: MUTED,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.5,
    marginTop: 4,
  },
  coverScoreMax: {
    color: MUTED,
    fontSize: 11,
    marginTop: 2,
  },
  coverBottom: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  coverBottomBar: {
    backgroundColor: DARK3,
    height: 3,
    width: "100%",
    marginTop: 40,
  },
  // ── Section pages ──
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
  // ── KPI Grid ──
  kpiGrid: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  kpiCard: {
    backgroundColor: DARK2,
    borderRadius: 8,
    padding: 14,
    width: "30%",
    borderWidth: 1,
    borderColor: DARK3,
  },
  kpiValue: {
    color: GOLD,
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1,
  },
  kpiLabel: {
    color: MUTED,
    fontSize: 8,
    marginTop: 4,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.8,
  },
  // ── Score Breakdown ──
  breakdownRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  breakdownLabel: {
    color: LIGHT,
    fontSize: 9,
    width: 100,
    fontFamily: "Helvetica-Bold",
  },
  breakdownBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: DARK3,
    borderRadius: 4,
  },
  breakdownBarFill: {
    height: 8,
    borderRadius: 4,
  },
  breakdownScore: {
    color: GOLD,
    fontSize: 9,
    width: 28,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
  },
  // ── Checklist ──
  checklistItem: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
    gap: 8,
    padding: 10,
    backgroundColor: DARK2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: DARK3,
  },
  checklistDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  checklistDotText: {
    color: WHITE,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
  },
  checklistText: {
    flex: 1,
  },
  checklistLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  checklistDetail: {
    color: MUTED,
    fontSize: 8,
    marginTop: 2,
    lineHeight: 1.4,
  },
  // ── Gaps & Recs ──
  gapItem: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
    gap: 8,
    padding: 10,
    backgroundColor: DARK2,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: WARNING,
  },
  gapBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: WARNING,
    marginTop: 3,
  },
  gapText: {
    color: LIGHT,
    fontSize: 9,
    flex: 1,
    lineHeight: 1.5,
  },
  recItem: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
    gap: 8,
    padding: 10,
    backgroundColor: DARK2,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: SUCCESS,
  },
  recBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: SUCCESS,
    marginTop: 3,
  },
  recText: {
    color: LIGHT,
    fontSize: 9,
    flex: 1,
    lineHeight: 1.5,
  },
  // ── Two-column layout ──
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
  // ── Footer ──
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
    color: MUTED,
    fontSize: 7,
  },
  footerAccent: {
    color: GOLD,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
  },
  // ── Page number ──
  pageNum: {
    position: "absolute",
    bottom: 20,
    right: 40,
    color: MUTED,
    fontSize: 7,
  },
  // ── Horizontal bar chart ──
  barChartRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  barChartLabel: {
    color: LIGHT,
    fontSize: 8,
    width: 80,
  },
  barChartBg: {
    flex: 1,
    height: 14,
    backgroundColor: DARK3,
    borderRadius: 3,
  },
  barChartFill: {
    height: 14,
    borderRadius: 3,
  },
  barChartValue: {
    color: GOLD,
    fontSize: 8,
    width: 30,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
  },
  // ── Info box ──
  infoBox: {
    backgroundColor: DARK2,
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: DARK3,
    marginBottom: 12,
  },
  infoBoxTitle: {
    color: GOLD,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    letterSpacing: 0.8,
  },
  infoBoxText: {
    color: LIGHT,
    fontSize: 9,
    lineHeight: 1.5,
  },
  // ── Score badge ──
  scoreBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  scoreBadgeText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return SUCCESS;
  if (score >= 60) return WARNING;
  if (score >= 40) return "#F97316";
  return DANGER;
}

function scoreLabel(score: number): string {
  if (score >= 80) return "EXCELENTE";
  if (score >= 60) return "BOM";
  if (score >= 40) return "REGULAR";
  return "CRÍTICO";
}

function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function pct(v: number): string {
  return `${Math.round(v)}%`;
}

// ─── Footer component ─────────────────────────────────────────────────────────

function Footer({ catalog, date }: { catalog: string; date: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>
        Databricks Governance Tool · Catálogo:{" "}
        <Text style={styles.footerAccent}>{catalog}</Text>
      </Text>
      <Text style={styles.footerText}>{date}</Text>
    </View>
  );
}

// ─── Main PDF Document ────────────────────────────────────────────────────────

export function GovernancePdfDocument({ data }: { data: PdfReportData }) {
  const score = Math.round(data.metadata.governanceScore ?? 0);
  const sc = scoreColor(score);
  const sl = scoreLabel(score);
  const dateStr = formatDate(data.metadata.auditDate);
  const catalog = data.metadata.targetCatalog;

  const breakdownItems = [
    { label: "Documentação", value: data.breakdown.documentation, color: INFO },
    { label: "Classificação", value: data.breakdown.classification, color: WARNING },
    { label: "Acesso", value: data.breakdown.access, color: GOLD },
    { label: "Linhagem", value: data.breakdown.lineage, color: "#A78BFA" },
    { label: "Segurança", value: data.breakdown.security, color: SUCCESS },
  ];

  return (
    <Document
      title={`Relatório de Governança — ${catalog}`}
      author="Databricks Governance Tool"
      subject="Auditoria de Governança Unity Catalog"
    >
      {/* ── CAPA ── */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.coverTopBar} />
        <View style={styles.coverContent}>
          {/* Badge */}
          <View>
            <View style={styles.coverBadge}>
              <Text style={styles.coverBadgeText}>UNITY CATALOG · DATABRICKS</Text>
            </View>

            {/* Title */}
            <Text style={styles.coverTitle}>
              Relatório de{"\n"}
              <Text style={styles.coverTitleAccent}>Governança de Dados</Text>
            </Text>
            <Text style={styles.coverSubtitle}>
              Auditoria completa do ambiente Databricks Unity Catalog.{"\n"}
              Levantamento de ativos, análise de maturidade e recomendações{"\n"}
              baseadas em melhores práticas de governança.
            </Text>
          </View>

          {/* Score + Meta */}
          <View style={{ display: "flex", flexDirection: "row", gap: 24, alignItems: "flex-start" }}>
            <View style={styles.coverScoreBox}>
              <Text style={[styles.coverScoreNumber, { color: sc }]}>{score}</Text>
              <Text style={styles.coverScoreMax}>/100</Text>
              <Text style={styles.coverScoreLabel}>SCORE DE GOVERNANÇA</Text>
              <View style={[styles.scoreBadge, { backgroundColor: sc + "22", marginTop: 8 }]}>
                <Text style={[styles.scoreBadgeText, { color: sc }]}>{sl}</Text>
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <View style={styles.coverDivider} />
              <View style={styles.coverMeta}>
                <View style={styles.coverMetaItem}>
                  <Text style={styles.coverMetaLabel}>CATÁLOGO AUDITADO</Text>
                  <Text style={styles.coverMetaValue}>{catalog}</Text>
                </View>
                <View style={styles.coverMetaItem}>
                  <Text style={styles.coverMetaLabel}>DATA DA AUDITORIA</Text>
                  <Text style={styles.coverMetaValue}>{dateStr}</Text>
                </View>
              </View>
              <View style={[styles.coverDivider, { marginTop: 12 }]} />
              <View style={styles.coverMeta}>
                <View style={styles.coverMetaItem}>
                  <Text style={styles.coverMetaLabel}>HOST</Text>
                  <Text style={[styles.coverMetaValue, { fontSize: 8 }]}>
                    {data.metadata.databricksHost.replace("https://", "").slice(0, 40)}
                  </Text>
                </View>
              </View>
              <View style={[styles.coverDivider, { marginTop: 12 }]} />
              {/* Mini KPIs */}
              <View style={{ display: "flex", flexDirection: "row", gap: 16, marginTop: 4 }}>
                {[
                  { label: "Catálogos", value: data.summary.totalCatalogs },
                  { label: "Schemas", value: data.summary.totalSchemas },
                  { label: "Tabelas/Views", value: data.summary.totalTables },
                ].map(({ label, value }) => (
                  <View key={label}>
                    <Text style={{ color: GOLD, fontSize: 18, fontFamily: "Helvetica-Bold" }}>{value}</Text>
                    <Text style={{ color: MUTED, fontSize: 7, marginTop: 2 }}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.coverBottomBar} />
        </View>
      </Page>

      {/* ── PÁG 2: MÉTRICAS EXECUTIVAS ── */}
      <Page size="A4" style={styles.sectionPage}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderAccent} />
          <View>
            <Text style={styles.sectionTitle}>Métricas Executivas</Text>
            <Text style={styles.sectionSubtitle}>Visão consolidada dos ativos e cobertura de governança</Text>
          </View>
        </View>

        {/* KPI Grid */}
        <View style={styles.kpiGrid}>
          {[
            { label: "CATÁLOGOS", value: String(data.summary.totalCatalogs) },
            { label: "SCHEMAS", value: String(data.summary.totalSchemas) },
            { label: "TABELAS / VIEWS", value: String(data.summary.totalTables) },
            { label: "COBERTURA DOC.", value: pct(data.summary.docCoverage) },
            { label: "COBERTURA TAGS", value: pct(data.summary.tagCoverage) },
            { label: "GRANTS TOTAIS", value: String(data.summary.totalGrants) },
            { label: "RELAÇÕES LINHAGEM", value: String(data.summary.lineageEdges) },
            { label: "FUNÇÕES SEGURANÇA", value: String(data.summary.securityFunctions) },
            { label: "SCORE GERAL", value: `${score}/100` },
          ].map(({ label, value }) => (
            <View key={label} style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{value}</Text>
              <Text style={styles.kpiLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Score Breakdown */}
        <View style={[styles.infoBox, { marginTop: 8 }]}>
          <Text style={styles.infoBoxTitle}>COMPOSIÇÃO DO SCORE DE GOVERNANÇA</Text>
          {breakdownItems.map(({ label, value, color }) => (
            <View key={label} style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>{label}</Text>
              <View style={styles.breakdownBarBg}>
                <View
                  style={[
                    styles.breakdownBarFill,
                    { width: `${Math.min(100, value)}%`, backgroundColor: color },
                  ]}
                />
              </View>
              <Text style={[styles.breakdownScore, { color }]}>{Math.round(value)}</Text>
            </View>
          ))}
        </View>

        {/* Coverage bars */}
        <View style={styles.infoBox}>
          <Text style={styles.infoBoxTitle}>COBERTURA POR DIMENSÃO</Text>
          {[
            { label: "Documentação", value: data.summary.docCoverage, color: INFO },
            { label: "Classificação (Tags)", value: data.summary.tagCoverage, color: WARNING },
          ].map(({ label, value, color }) => (
            <View key={label} style={styles.barChartRow}>
              <Text style={styles.barChartLabel}>{label}</Text>
              <View style={styles.barChartBg}>
                <View
                  style={[
                    styles.barChartFill,
                    { width: `${Math.min(100, value)}%`, backgroundColor: color },
                  ]}
                />
              </View>
              <Text style={[styles.barChartValue, { color }]}>{pct(value)}</Text>
            </View>
          ))}
        </View>

        <Footer catalog={catalog} date={dateStr} />
      </Page>

      {/* ── PÁG 3: CHECKLIST DE MELHORES PRÁTICAS ── */}
      <Page size="A4" style={styles.sectionPage}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderAccent} />
          <View>
            <Text style={styles.sectionTitle}>Checklist de Melhores Práticas</Text>
            <Text style={styles.sectionSubtitle}>Avaliação automática contra padrões de governança de dados</Text>
          </View>
        </View>

        {data.bestPractices.map((item, i) => (
          <View key={i} style={styles.checklistItem}>
            <View
              style={[
                styles.checklistDot,
                { backgroundColor: item.passed ? SUCCESS : DANGER },
              ]}
            >
              <Text style={styles.checklistDotText}>{item.passed ? "✓" : "✗"}</Text>
            </View>
            <View style={styles.checklistText}>
              <Text style={[styles.checklistLabel, { color: item.passed ? SUCCESS : DANGER }]}>
                {item.label}
              </Text>
              <Text style={styles.checklistDetail}>{item.detail}</Text>
            </View>
          </View>
        ))}

        <Footer catalog={catalog} date={dateStr} />
      </Page>

      {/* ── PÁG 4: GAPS E RECOMENDAÇÕES ── */}
      <Page size="A4" style={styles.sectionPage}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderAccent} />
          <View>
            <Text style={styles.sectionTitle}>Gaps e Recomendações</Text>
            <Text style={styles.sectionSubtitle}>Pontos de atenção identificados e ações sugeridas</Text>
          </View>
        </View>

        <View style={styles.twoCol}>
          {/* Gaps */}
          <View style={styles.col}>
            <Text style={styles.colTitle}>⚠ Gaps Identificados ({data.gaps.length})</Text>
            {data.gaps.length === 0 ? (
              <View style={[styles.infoBox, { borderLeftWidth: 3, borderLeftColor: SUCCESS }]}>
                <Text style={[styles.infoBoxText, { color: SUCCESS }]}>
                  Nenhum gap crítico identificado. Excelente nível de governança!
                </Text>
              </View>
            ) : (
              data.gaps.map((gap, i) => (
                <View key={i} style={styles.gapItem}>
                  <View style={styles.gapBullet} />
                  <Text style={styles.gapText}>{gap}</Text>
                </View>
              ))
            )}
          </View>

          {/* Recommendations */}
          <View style={styles.col}>
            <Text style={styles.colTitle}>→ Recomendações ({data.recommendations.length})</Text>
            {data.recommendations.length === 0 ? (
              <View style={[styles.infoBox, { borderLeftWidth: 3, borderLeftColor: INFO }]}>
                <Text style={[styles.infoBoxText, { color: INFO }]}>
                  Nenhuma recomendação adicional no momento.
                </Text>
              </View>
            ) : (
              data.recommendations.map((rec, i) => (
                <View key={i} style={styles.recItem}>
                  <View style={styles.recBullet} />
                  <Text style={styles.recText}>{rec}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Summary box */}
        <View style={[styles.infoBox, { marginTop: 16, borderWidth: 1, borderColor: sc + "44" }]}>
          <Text style={[styles.infoBoxTitle, { color: sc }]}>
            CONCLUSÃO — NÍVEL DE MATURIDADE: {sl}
          </Text>
          <Text style={styles.infoBoxText}>
            O ambiente Databricks auditado obteve um score de governança de {score}/100,
            classificado como "{sl}".{" "}
            {score >= 80
              ? "O ambiente demonstra alto nível de maturidade em governança de dados, com boa cobertura de documentação, classificação, controles de acesso e segurança."
              : score >= 60
              ? "O ambiente apresenta uma base sólida de governança, com oportunidades de melhoria nas dimensões identificadas nos gaps acima."
              : score >= 40
              ? "O ambiente requer atenção em múltiplas dimensões de governança. Recomenda-se priorizar as ações listadas para elevar o nível de maturidade."
              : "O ambiente apresenta lacunas críticas de governança. É necessário um plano de ação imediato para endereçar os gaps identificados."}
          </Text>
        </View>

        <Footer catalog={catalog} date={dateStr} />
      </Page>
    </Document>
  );
}
