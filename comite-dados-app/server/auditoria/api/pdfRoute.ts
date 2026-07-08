import { type Express, type Request, type Response } from "express";
import React from "react";
import { renderToStream } from "@react-pdf/renderer";
import { getAuditSession, getAnalysisResultsBySession } from "../../db";
import { computeGovernanceScore, type GovernanceAnalysisData } from "../databricks";
import { GovernancePdfDocument, type PdfReportData } from "../services/pdfReport";

// ─── Build PDF data from DB records ──────────────────────────────────────────

function buildPdfData(session: any, results: any[]): PdfReportData {
  // Reconstruct GovernanceAnalysisData from stored analysis results
  const byType: Record<string, any> = {};
  for (const r of results) {
    if (r.status === "completed" && r.data) {
      byType[r.type] = typeof r.data === "string" ? JSON.parse(r.data) : r.data;
    }
  }

  const structure = byType["structure"] ?? { catalogs: [], schemas: [], tables: [], summary: { totalCatalogs: 0, totalSchemas: 0, totalTables: 0, totalViews: 0 } };
  const glossary = byType["glossary"] ?? { tablesWithComments: [], columnsWithComments: [], summary: { totalTables: 0, documentedTables: 0, tableDocCoverage: 0, totalColumns: 0, documentedColumns: 0, columnDocCoverage: 0 } };
  const tags = byType["tags"] ?? { tableTags: [], columnTags: [], tagDistribution: [], summary: { totalTableTags: 0, totalColumnTags: 0, uniqueTags: 0, tablesWithTags: 0, sensitiveDataTagged: 0 } };
  const access = byType["access"] ?? { tablePrivileges: [], catalogPrivileges: [], schemaPrivileges: [], privilegeDistribution: [], summary: { totalGrants: 0, uniqueGrantees: 0, tableGrants: 0, catalogGrants: 0, schemaGrants: 0 } };
  const lineage = byType["lineage"] ?? { lineageEdges: [], summary: { totalEdges: 0, uniqueSources: 0, uniqueTargets: 0 } };
  const security = byType["security"] ?? { maskingFunctions: [], rowFilters: [], columnMasks: [], summary: { totalFunctions: 0, rowFilterCount: 0, columnMaskCount: 0, tablesChecked: 0 } };

  const analysisData: GovernanceAnalysisData = { structure, glossary, tags, access, lineage, security };
  const { score, breakdown, gaps, recommendations } = computeGovernanceScore(analysisData);

  // Build best practices checklist
  const docCov = glossary.summary.tableDocCoverage ?? 0;
  const colDocCov = glossary.summary.columnDocCoverage ?? 0;
  const tagCount = tags.summary.totalTableTags + tags.summary.totalColumnTags;
  const tablesWithTagsCount = tags.summary.tablesWithTags ?? 0;
  const totalTablesAndViews = (structure.summary.totalTables ?? 0) + (structure.summary.totalViews ?? 0);
  const lineageEdges = lineage.summary.totalEdges ?? 0;
  const secFuncs = security.summary.totalFunctions ?? 0;
  const grants = access.summary.totalGrants ?? 0;

  const bestPractices = [
    {
      label: "Documentação de tabelas (≥ 80%)",
      passed: docCov >= 80,
      detail: `Cobertura atual: ${Math.round(docCov)}% das tabelas possuem descrição. Meta: 80%.`,
    },
    {
      label: "Documentação de colunas (≥ 70%)",
      passed: colDocCov >= 70,
      detail: `Cobertura atual: ${Math.round(colDocCov)}% das colunas possuem descrição. Meta: 70%.`,
    },
    {
      label: "Classificação por tags (PII/LGPD)",
      passed: tagCount > 0,
      detail: tagCount > 0
        ? `${tagCount} tags aplicadas em tabelas e colunas.`
        : "Nenhuma tag de classificação encontrada. Recomenda-se classificar dados sensíveis.",
    },
    {
      label: "Políticas de acesso definidas",
      passed: grants > 0,
      detail: grants > 0
        ? `${grants} grants mapeados no catálogo.`
        : "Nenhum grant encontrado. Verifique as permissões de acesso.",
    },
    {
      label: "Linhagem de dados rastreada",
      passed: lineageEdges > 0,
      detail: lineageEdges > 0
        ? `${lineageEdges} relações de linhagem registradas em system.access.table_lineage.`
        : "Nenhuma linhagem encontrada. Habilite o rastreamento de linhagem no Unity Catalog.",
    },
    {
      label: "Segurança dinâmica implementada",
      passed: secFuncs > 0,
      detail: secFuncs > 0
        ? `${secFuncs} funções de mascaramento/filtro de linha identificadas.`
        : "Nenhuma função de segurança dinâmica encontrada. Considere implementar Row/Column Level Security.",
    },
  ];

  return {
    metadata: {
      databricksHost: session.databricksHost ?? "",
      targetCatalog: session.targetCatalog ?? "",
      auditDate: session.createdAt ?? new Date(),
      governanceScore: score,
    },
    summary: {
      totalCatalogs: structure.summary.totalCatalogs ?? 0,
      totalSchemas: structure.summary.totalSchemas ?? 0,
      totalTables: (structure.summary.totalTables ?? 0) + (structure.summary.totalViews ?? 0),
      docCoverage: docCov,
      tagCoverage: totalTablesAndViews > 0 ? Math.round((tablesWithTagsCount / Math.max(1, totalTablesAndViews)) * 100) : 0,
      totalGrants: grants,
      lineageEdges,
      securityFunctions: secFuncs,
    },
    breakdown,
    gaps: Array.from(new Set(gaps)),
    recommendations: Array.from(new Set(recommendations)),
    bestPractices,
  };
}

// ─── Register route ───────────────────────────────────────────────────────────

export function registerPdfRoute(app: Express) {
  app.get("/api/report/:sessionId/pdf", async (req: Request, res: Response) => {
    try {
      const sessionId = parseInt(req.params.sessionId, 10);
      if (isNaN(sessionId)) {
        res.status(400).json({ error: "sessionId inválido" });
        return;
      }

      const session = await getAuditSession(sessionId);
      if (!session) {
        res.status(404).json({ error: "Sessão não encontrada" });
        return;
      }

      const results = await getAnalysisResultsBySession(sessionId);
      const pdfData = buildPdfData(session, results);

      const doc = React.createElement(GovernancePdfDocument as any, { data: pdfData });
      const stream = await renderToStream(doc as any);

      const catalogSlug = (pdfData.metadata.targetCatalog || "catalog").replace(/[^a-z0-9]/gi, "_");
      const dateSlug = new Date(pdfData.metadata.auditDate).toISOString().slice(0, 10);
      const filename = `governance_report_${catalogSlug}_${dateSlug}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      stream.pipe(res);
    } catch (err) {
      console.error("[PDF] Error generating report:", err);
      res.status(500).json({ error: "Erro ao gerar relatório PDF" });
    }
  });
}
