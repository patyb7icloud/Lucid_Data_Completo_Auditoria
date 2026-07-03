/**
 * Databricks SQL REST API integration
 * Uses the Databricks SQL Statement Execution API to run queries against Unity Catalog
 */

export interface DatabricksConfig {
  host: string;
  token: string;
  catalog: string;
}

interface StatementResult {
  statement_id: string;
  status: { state: string; error?: { message: string } };
  result?: {
    data_array?: string[][];
    schema?: { columns: Array<{ name: string; type_name: string }> };
  };
  manifest?: {
    schema?: { columns: Array<{ name: string; type_name: string }> };
  };
}

export async function executeStatement(
  config: DatabricksConfig,
  sql: string,
  warehouseId?: string
): Promise<{ columns: string[]; rows: Record<string, string | null>[] }> {
  const baseUrl = config.host.replace(/\/$/, "");

  // First, discover a warehouse if not provided
  let wId = warehouseId;
  if (!wId) {
    const whRes = await fetch(`${baseUrl}/api/2.0/sql/warehouses`, {
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
    });
    if (!whRes.ok) {
      const err = await whRes.text();
      throw new Error(`Failed to list warehouses: ${err}`);
    }
    const whData = await whRes.json();
    const warehouses = whData.warehouses ?? [];
    if (warehouses.length === 0) throw new Error("No SQL warehouses found in this Databricks workspace.");
    // Prefer running warehouses, else pick first
    const running = warehouses.find((w: any) => w.state === "RUNNING");
    wId = (running ?? warehouses[0]).id;
  }

  // Submit statement
  const submitRes = await fetch(`${baseUrl}/api/2.0/sql/statements`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      statement: sql,
      warehouse_id: wId,
      wait_timeout: "30s",
      on_wait_timeout: "CONTINUE",
    }),
  });

  if (!submitRes.ok) {
    const err = await submitRes.text();
    throw new Error(`Failed to submit SQL statement: ${err}`);
  }

  let data: StatementResult = await submitRes.json();

  // Poll until done
  let attempts = 0;
  while (
    data.status.state === "PENDING" ||
    data.status.state === "RUNNING"
  ) {
    if (attempts++ > 30) throw new Error("Query timed out after 60 seconds");
    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetch(
      `${baseUrl}/api/2.0/sql/statements/${data.statement_id}`,
      {
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
      }
    );
    data = await pollRes.json();
  }

  if (data.status.state === "FAILED" || data.status.state === "CANCELED") {
    throw new Error(data.status.error?.message ?? "Query failed");
  }

  const schema = data.manifest?.schema?.columns ?? data.result?.schema?.columns ?? [];
  const columns = schema.map((c) => c.name);
  const rows = (data.result?.data_array ?? []).map((row) => {
    const obj: Record<string, string | null> = {};
    columns.forEach((col, i) => {
      obj[col] = row[i] ?? null;
    });
    return obj;
  });

  return { columns, rows };
}

// ─── Test Connection ──────────────────────────────────────────────────────────

export async function testConnection(config: DatabricksConfig): Promise<{ ok: boolean; message: string; warehouseId?: string }> {
  try {
    const baseUrl = config.host.replace(/\/$/, "");
    const res = await fetch(`${baseUrl}/api/2.0/sql/warehouses`, {
      headers: { Authorization: `Bearer ${config.token}` },
    });
    if (!res.ok) return { ok: false, message: `Authentication failed (HTTP ${res.status})` };
    const data = await res.json();
    const warehouses = data.warehouses ?? [];
    if (warehouses.length === 0) return { ok: false, message: "No SQL warehouses found in this workspace" };
    const running = warehouses.find((w: any) => w.state === "RUNNING");
    const wh = running ?? warehouses[0];
    return { ok: true, message: `Connected successfully. Using warehouse: ${wh.name}`, warehouseId: wh.id };
  } catch (e: any) {
    return { ok: false, message: e.message ?? "Connection failed" };
  }
}

// ─── Analysis 1: Structure Mapping ───────────────────────────────────────────

export async function analyzeStructure(config: DatabricksConfig) {
  const catalogsResult = await executeStatement(config, `SELECT catalog_name, catalog_owner, comment FROM system.information_schema.catalogs`);
  const schemasResult = await executeStatement(config, `SELECT catalog_name, schema_name, schema_owner, comment FROM system.information_schema.schemata WHERE catalog_name = '${config.catalog}'`);
  const tablesResult = await executeStatement(config, `SELECT table_catalog, table_schema, table_name, table_type, table_owner FROM system.information_schema.tables WHERE table_catalog = '${config.catalog}'`);

  // Ensure rows are arrays (defensive programming)
  const catalogsRows = catalogsResult?.rows ?? [];
  const schemasRows = schemasResult?.rows ?? [];
  const tablesRows = tablesResult?.rows ?? [];

  return {
    catalogs: catalogsRows,
    schemas: schemasRows,
    tables: tablesRows,
    summary: {
      totalCatalogs: catalogsRows.length,
      totalSchemas: schemasRows.length,
      totalTables: tablesRows.filter((r) => r.table_type === "MANAGED" || r.table_type === "EXTERNAL" || r.table_type === "BASE TABLE").length,
      totalViews: tablesRows.filter((r) => r.table_type === "VIEW").length,
    },
  };
}

// ─── Analysis 2: Data Glossary ────────────────────────────────────────────────

export async function analyzeGlossary(config: DatabricksConfig) {
  const tablesWithComments = await executeStatement(config, `SELECT table_catalog, table_schema, table_name, comment as table_description FROM system.information_schema.tables WHERE table_catalog = '${config.catalog}' AND comment IS NOT NULL`);
  const allTables = await executeStatement(config, `SELECT COUNT(*) as total FROM system.information_schema.tables WHERE table_catalog = '${config.catalog}'`);
  const columnsWithComments = await executeStatement(config, `SELECT table_catalog, table_schema, table_name, column_name, data_type, comment as column_description FROM system.information_schema.columns WHERE table_catalog = '${config.catalog}' AND comment IS NOT NULL`);
  const allColumns = await executeStatement(config, `SELECT COUNT(*) as total FROM system.information_schema.columns WHERE table_catalog = '${config.catalog}'`);

  // Ensure rows are arrays (defensive programming)
  const tablesWithCommentsRows = tablesWithComments?.rows ?? [];
  const allTablesRows = allTables?.rows ?? [];
  const columnsWithCommentsRows = columnsWithComments?.rows ?? [];
  const allColumnsRows = allColumns?.rows ?? [];

  const totalTables = parseInt(allTablesRows[0]?.total ?? "0");
  const totalColumns = parseInt(allColumnsRows[0]?.total ?? "0");
  const documentedTables = tablesWithCommentsRows.length;
  const documentedColumns = columnsWithCommentsRows.length;

  return {
    tablesWithComments: tablesWithCommentsRows,
    columnsWithComments: columnsWithCommentsRows,
    summary: {
      totalTables,
      documentedTables,
      tableDocCoverage: totalTables > 0 ? Math.round((documentedTables / totalTables) * 100) : 0,
      totalColumns,
      documentedColumns,
      columnDocCoverage: totalColumns > 0 ? Math.round((documentedColumns / totalColumns) * 100) : 0,
    },
  };
}

// ─── Analysis 3: Tag Classification ──────────────────────────────────────────

export async function analyzeTags(config: DatabricksConfig) {
  const tableTags = await executeStatement(config, `SELECT catalog_name, schema_name, table_name, tag_name, tag_value FROM system.information_schema.table_tags WHERE catalog_name = '${config.catalog}'`);
  const columnTags = await executeStatement(config, `SELECT catalog_name, schema_name, table_name, column_name, tag_name, tag_value FROM system.information_schema.column_tags WHERE catalog_name = '${config.catalog}'`);

  // Ensure rows are arrays (defensive programming)
  const tableTagsRows = tableTags?.rows ?? [];
  const columnTagsRows = columnTags?.rows ?? [];

  // Aggregate tag distribution
  const tagDist: Record<string, number> = {};
  [...tableTagsRows, ...columnTagsRows].forEach((r) => {
    const tag = (r.tag_name ?? "unknown").toLowerCase();
    tagDist[tag] = (tagDist[tag] ?? 0) + 1;
  });

  // Count unique tables with tags
  const tablesWithTags = new Set(tableTagsRows.map((r) => `${r.schema_name}.${r.table_name}`));

  const sensitiveKeywords = ["pii", "lgpd", "confidential", "confidencial", "sensitive", "sensivel", "restricted", "restrito"];
  const sensitiveCount = [...tableTagsRows, ...columnTagsRows].filter((r) =>
    sensitiveKeywords.some((k) => (r.tag_name ?? "").toLowerCase().includes(k))
  ).length;

  return {
    tableTags: tableTagsRows,
    columnTags: columnTagsRows,
    tagDistribution: Object.entries(tagDist).map(([name, count]) => ({ name, count })),
    summary: {
      totalTableTags: tableTags.rows.length,
      totalColumnTags: columnTags.rows.length,
      uniqueTags: Object.keys(tagDist).length,
      tablesWithTags: tablesWithTags.size,
      sensitiveDataTagged: sensitiveCount,
    },
  };
}

// ─── Analysis 4: Access Policies (Grants) ────────────────────────────────────

export async function analyzeAccess(config: DatabricksConfig) {
  const tablePrivs = await executeStatement(config, `SELECT grantor, grantee, table_catalog, table_schema, table_name, privilege_type FROM system.information_schema.table_privileges WHERE table_catalog = '${config.catalog}'`);
  const catalogPrivs = await executeStatement(config, `SELECT grantor, grantee, catalog_name, privilege_type FROM system.information_schema.catalog_privileges WHERE catalog_name = '${config.catalog}'`);
  const schemaPrivs = await executeStatement(config, `SELECT grantor, grantee, catalog_name, schema_name, privilege_type FROM system.information_schema.schema_privileges WHERE catalog_name = '${config.catalog}'`);

  // Ensure rows are arrays (defensive programming)
  const tablePrivsRows = tablePrivs?.rows ?? [];
  const catalogPrivsRows = catalogPrivs?.rows ?? [];
  const schemaPrivsRows = schemaPrivs?.rows ?? [];

  // Privilege distribution
  const privDist: Record<string, number> = {};
  [...tablePrivsRows, ...catalogPrivsRows, ...schemaPrivsRows].forEach((r) => {
    const p = r.privilege_type ?? "UNKNOWN";
    privDist[p] = (privDist[p] ?? 0) + 1;
  });

  // Unique grantees
  const grantees = new Set([
    ...tablePrivsRows.map((r) => r.grantee),
    ...catalogPrivsRows.map((r) => r.grantee),
    ...schemaPrivsRows.map((r) => r.grantee),
  ]);

  return {
    tablePrivileges: tablePrivsRows,
    catalogPrivileges: catalogPrivsRows,
    schemaPrivileges: schemaPrivsRows,
    privilegeDistribution: Object.entries(privDist).map(([name, count]) => ({ name, count })),
    summary: {
      totalGrants: tablePrivsRows.length + catalogPrivsRows.length + schemaPrivsRows.length,
      uniqueGrantees: grantees.size,
      tableGrants: tablePrivsRows.length,
      catalogGrants: catalogPrivsRows.length,
      schemaGrants: schemaPrivsRows.length,
    },
  };
}

// ─── Analysis 5: Data Lineage ─────────────────────────────────────────────────

export async function analyzeLineage(config: DatabricksConfig) {
  const lineage = await executeStatement(config, `SELECT source_table_catalog, source_table_schema, source_table_name, target_table_catalog, target_table_schema, target_table_name FROM system.access.table_lineage WHERE target_table_catalog = '${config.catalog}' OR source_table_catalog = '${config.catalog}' LIMIT 500`);

  // Ensure rows are arrays (defensive programming)
  const lineageRows = lineage?.rows ?? [];

  // Build adjacency for summary
  const sourceSet = new Set(lineageRows.map((r) => `${r.source_table_schema}.${r.source_table_name}`));
  const targetSet = new Set(lineageRows.map((r) => `${r.target_table_schema}.${r.target_table_name}`));

  return {
    lineageEdges: lineageRows,
    summary: {
      totalEdges: lineageRows.length,
      uniqueSources: sourceSet.size,
      uniqueTargets: targetSet.size,
    },
  };
}

// ─── Analysis 6: Dynamic Security ────────────────────────────────────────────

export async function analyzeSecurity(config: DatabricksConfig) {
  const routines = await executeStatement(config, `SELECT routine_catalog, routine_schema, routine_name, routine_definition FROM system.information_schema.routines WHERE routine_catalog = '${config.catalog}' AND routine_type = 'FUNCTION'`);

  // DESCRIBE EXTENDED for tables with potential masks — sample up to 20 tables
  const tablesResult = await executeStatement(config, `SELECT table_schema, table_name FROM system.information_schema.tables WHERE table_catalog = '${config.catalog}' AND table_type = 'BASE TABLE' LIMIT 20`);

  // Ensure rows are arrays (defensive programming)
  const routinesRows = routines?.rows ?? [];
  const tablesRows = tablesResult?.rows ?? [];

  const rowFilters: Array<{ table: string; definition: string }> = [];
  const columnMasks: Array<{ table: string; column: string; definition: string }> = [];

  // Parse routine definitions for masking patterns - expanded keywords
  routinesRows.forEach((r) => {
    const def = (r.routine_definition ?? "").toLowerCase();
    const name = (r.routine_name ?? "").toLowerCase();
    
    // ABAC Pattern Detection: Functions specifically designed for security policies
    // Row-level security patterns
    if (
      // Explicit keywords in definition or name
      def.includes("mask") || 
      def.includes("filter") || 
      def.includes("rls") || 
      def.includes("row_filter") ||
      def.includes("row_level") ||
      def.includes("sensitive") ||
      name.includes("mask") ||
      name.includes("filter") ||
      name.includes("rls") ||
      name.includes("security") ||
      // ABAC Pattern: Common naming conventions for row filter functions
      name.includes("filtrar") ||
      name.includes("filter_") ||
      name.includes("_filter") ||
      (def.includes("=") && def.includes("where")) // Simple WHERE condition pattern
    ) {
      rowFilters.push({ table: r.routine_name ?? "", definition: r.routine_definition ?? "" });
    }
    
    // Column-level masking patterns
    if (
      // Explicit keywords
      def.includes("column_mask") || 
      def.includes("mask_value") || 
      def.includes("sha") || 
      def.includes("hash") ||
      def.includes("encrypt") ||
      def.includes("redact") ||
      def.includes("anonymize") ||
      name.includes("mask") ||
      name.includes("encrypt") ||
      // ABAC Pattern: Common naming conventions for column mask functions
      name.includes("mascarar") ||
      name.includes("mask_") ||
      name.includes("_mask") ||
      (def.includes("case") && def.includes("when")) // CASE WHEN masking pattern
    ) {
      columnMasks.push({ table: r.routine_name ?? "", column: "", definition: r.routine_definition ?? "" });
    }
  });

  return {
    maskingFunctions: routinesRows,
    rowFilters,
    columnMasks,
    summary: {
      totalFunctions: routinesRows.length,
      rowFilterCount: rowFilters.length,
      columnMaskCount: columnMasks.length,
      tablesChecked: tablesRows.length,
    },
  };
}

// ─── Governance Best Practices Comparison ────────────────────────────────────

export interface GovernanceAnalysisData {
  structure: Awaited<ReturnType<typeof analyzeStructure>>;
  glossary: Awaited<ReturnType<typeof analyzeGlossary>>;
  tags: Awaited<ReturnType<typeof analyzeTags>>;
  access: Awaited<ReturnType<typeof analyzeAccess>>;
  lineage: Awaited<ReturnType<typeof analyzeLineage>>;
  security: Awaited<ReturnType<typeof analyzeSecurity>>;
}

export function computeGovernanceScore(data: GovernanceAnalysisData): {
  score: number;
  breakdown: Record<string, number>;
  recommendations: string[];
  gaps: string[];
} {
  const recommendations: string[] = [];
  const gaps: string[] = [];
  const breakdown: Record<string, number> = {};

  // 1. Documentation score (25 pts)
  const docScore = Math.round((data.glossary.summary.tableDocCoverage * 0.6 + data.glossary.summary.columnDocCoverage * 0.4) * 0.25);
  breakdown.documentation = docScore;
  if (data.glossary.summary.tableDocCoverage < 80) {
    gaps.push(`Apenas ${data.glossary.summary.tableDocCoverage}% das tabelas possuem descrição (meta: ≥80%)`);
    recommendations.push("Adicione comentários descritivos a todas as tabelas no Unity Catalog para melhorar o glossário de dados.");
  }
  if (data.glossary.summary.columnDocCoverage < 60) {
    gaps.push(`Apenas ${data.glossary.summary.columnDocCoverage}% das colunas possuem descrição (meta: ≥60%)`);
    recommendations.push("Documente as colunas críticas com comentários, especialmente aquelas que contêm dados sensíveis.");
  }

  // 2. Tag classification score (20 pts)
  const totalAssets = data.structure.summary.totalTables + data.structure.summary.totalViews;
  const taggedAssets = data.tags.summary.totalTableTags;
  const tagCoverage = totalAssets > 0 ? (taggedAssets / totalAssets) * 100 : 0;
  const tagScore = Math.min(20, Math.round(tagCoverage * 0.2));
  breakdown.classification = tagScore;
  if (tagCoverage < 50) {
    gaps.push(`Apenas ${Math.round(tagCoverage)}% dos ativos possuem tags de classificação (meta: ≥50%)`);
    recommendations.push("Implemente uma taxonomia de tags para classificar dados sensíveis (PII, LGPD, Confidencial).");
  }
  if (data.tags.summary.sensitiveDataTagged === 0) {
    gaps.push("Nenhum ativo foi marcado com tags de dados sensíveis (PII, LGPD)");
    recommendations.push("Identifique e marque todos os ativos que contêm dados pessoais ou sensíveis conforme a LGPD.");
  }

  // 3. Access control score (25 pts)
  const accessScore = data.access.summary.totalGrants > 0 ? 25 : 5;
  breakdown.access = accessScore;
  if (data.access.summary.totalGrants === 0) {
    gaps.push("Nenhuma política de acesso (grant) foi encontrada no catálogo");
    recommendations.push("Configure políticas de acesso granulares no Unity Catalog seguindo o princípio do menor privilégio.");
  }
  if (data.access.summary.uniqueGrantees > 50) {
    gaps.push(`Alto número de grantees únicos (${data.access.summary.uniqueGrantees}) — revisar permissões excessivas`);
    recommendations.push("Revise e consolide as permissões de acesso, utilizando grupos em vez de usuários individuais.");
  }

  // 4. Lineage score (15 pts)
  const lineageScore = data.lineage.summary.totalEdges > 0 ? 15 : 3;
  breakdown.lineage = lineageScore;
  if (data.lineage.summary.totalEdges === 0) {
    gaps.push("Nenhuma linhagem de dados registrada — rastreabilidade comprometida");
    recommendations.push("Habilite o rastreamento de linhagem no Unity Catalog para garantir a rastreabilidade dos dados.");
  }

  // 5. Dynamic security score (15 pts)
  // Se houver QUALQUER função detectada, é pelo menos um início de segurança dinâmica
  const hasMaskingFunctions = data.security.summary.totalFunctions > 0;
  const secScore = hasMaskingFunctions ? 10 : 0; // 10 pts se houver funções, 15 pts se categorizadas explicitamente
  const explicitMaskingDetected = data.security.summary.rowFilterCount > 0 || data.security.summary.columnMaskCount > 0;
  const finalSecScore = explicitMaskingDetected ? 15 : secScore;
  
  breakdown.security = finalSecScore;
  
  // Determinar qual gap mostrar
  if (data.security.summary.totalFunctions === 0) {
    // Nenhuma função de segurança encontrada
    gaps.push("Nenhuma política de mascaramento ou filtro de linha detectada");
    recommendations.push("Implemente Column Masking e Row-Level Security para proteger dados sensíveis em produção.");
  } else if (!explicitMaskingDetected) {
    // Funções encontradas mas sem categoria explícita
    gaps.push(
      `${data.security.summary.totalFunctions} função(ões) de segurança detectada(s), mas sem categorização explícita (esperado: keywords como 'mask', 'filter', 'rls')`
    );
    recommendations.push("Verifique se as funções de mascaramento estão nomeadas com palavras-chave detectáveis (mask, filter, rls, row_filter).");
  }

  const score = Math.min(100, Object.values(breakdown).reduce((a, b) => a + b, 0));

  return { score, breakdown, recommendations, gaps };
}
