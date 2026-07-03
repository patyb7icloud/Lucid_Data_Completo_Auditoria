/**
 * lineageParser.ts — Parser de lineagem automática
 *
 * Suporta:
 *   1. SQL: extrai FROM/JOIN e INSERT INTO para mapear dependências
 *   2. dbt manifest.json: lê o grafo de dependências de modelos dbt
 *
 * Retorna uma lista de pares { sourceName, targetName, type, transformationRule }
 * que podem ser gravados na tabela data_lineage.
 */

export interface ParsedLineageEdge {
  sourceName: string;
  targetName: string;
  type: "direto" | "transformado" | "agregado";
  transformationRule?: string;
  /** Lineagem nível de coluna: coluna na tabela fonte */
  sourceColumn?: string;
  /** Lineagem nível de coluna: coluna na tabela destino */
  targetColumn?: string;
}

// ─── SQL Parser ───────────────────────────────────────────────────────────────
// Regex patterns para extrair referências de tabela de SQL
const RE_FROM    = /\bFROM\s+([`"']?[\w.]+[`"']?(?:\.[`"']?[\w.]+[`"']?)?)/gi;
const RE_JOIN    = /\bJOIN\s+([`"']?[\w.]+[`"']?(?:\.[`"']?[\w.]+[`"']?)?)/gi;
const RE_INSERT  = /\bINSERT\s+(?:INTO\s+)?([`"']?[\w.]+[`"']?(?:\.[`"']?[\w.]+[`"']?)?)/gi;
const RE_CREATE  = /\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:VIEW|TABLE)\s+(?:IF\s+NOT\s+EXISTS\s+)?([`"']?[\w.]+[`"']?(?:\.[`"']?[\w.]+[`"']?)?)/gi;
const RE_UPDATE  = /\bUPDATE\s+([`"']?[\w.]+[`"']?(?:\.[`"']?[\w.]+[`"']?)?)/gi;

function stripQuotes(name: string): string {
  // Remove backticks e aspas de todas as partes, preservando os delimitadores de ponto
  // Ex: `casas_bahia_mvp`.`atendimento_satisfacao`.`dim_canal` -> casas_bahia_mvp.atendimento_satisfacao.dim_canal
  return name.replace(/[`"']/g, "").trim();
}


function extractTableRefs(sql: string): { target: string | null; sources: string[] } {
  // Remover comentários
  const clean = sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ");

  const sources = new Set<string>();
  let target: string | null = null;

  // Extrair alvo (INSERT INTO ou CREATE VIEW/TABLE)
  let m: RegExpExecArray | null;
  RE_INSERT.lastIndex = 0;
  if ((m = RE_INSERT.exec(clean)) !== null) {
    target = stripQuotes(m[1]);
  }
  RE_CREATE.lastIndex = 0;
  if ((m = RE_CREATE.exec(clean)) !== null) {
    target = stripQuotes(m[1]);
  }
  RE_UPDATE.lastIndex = 0;
  if ((m = RE_UPDATE.exec(clean)) !== null) {
    target = stripQuotes(m[1]);
  }

  // Extrair fontes (FROM + JOIN)
  RE_FROM.lastIndex = 0;
  while ((m = RE_FROM.exec(clean)) !== null) {
    const t = stripQuotes(m[1]);
    if (t.toLowerCase() !== "dual" && t !== target) sources.add(t);
  }
  RE_JOIN.lastIndex = 0;
  while ((m = RE_JOIN.exec(clean)) !== null) {
    const t = stripQuotes(m[1]);
    if (t !== target) sources.add(t);
  }

  return { target, sources: Array.from(sources) };
}

/**
 * Parseia um ou mais blocos SQL e extrai edges de lineagem.
 * Cada bloco SQL = uma transformação.
 */
export function parseSqlLineage(sqlContent: string): ParsedLineageEdge[] {
  const edges: ParsedLineageEdge[] = [];
  // Dividir por ponto-e-vírgula para processar statements individuais
  const statements = sqlContent.split(/;\s*\n|;\s*$/);

  for (const stmt of statements) {
    if (stmt.trim().length < 10) continue;
    const { target, sources } = extractTableRefs(stmt);
    if (!target || sources.length === 0) continue;

    const hasAgg = /\bGROUP\s+BY\b|\bSUM\s*\(|\bCOUNT\s*\(|\bAVG\s*\(/i.test(stmt);
    const hasTransform = /\bCASE\s+WHEN\b|\bCOALESCE\b|\bCAST\s*\(|\bCONVERT\s*\(/i.test(stmt);

    const type: ParsedLineageEdge["type"] = hasAgg ? "agregado" : hasTransform ? "transformado" : "direto";
    const transformationRule = stmt.trim().slice(0, 500); // primeiros 500 chars como documentação

    for (const src of sources) {
      const srcName = src.toUpperCase();
      const tgtName = target.toUpperCase();
      
      if (srcName === tgtName) continue;
      edges.push({ sourceName: srcName, targetName: tgtName, type, transformationRule });
    }
  }

  return edges;
}

/**
 * Extrai lineagem a nível de coluna de um statement SELECT … INTO ou INSERT INTO … SELECT.
 * Retorna edges com sourceColumn e targetColumn preenchidos quando detectável.
 *
 * Suporte:
 *   - INSERT INTO tgt (col1, col2) SELECT src_col1, src_col2 FROM src
 *   - SELECT col1, col2 INTO tgt FROM src  (SQL Server / Snowflake syntax)
 *   - CREATE TABLE tgt AS SELECT col1, col2 FROM src (BigQuery / Snowflake)
 *   - CREATE VIEW tgt AS SELECT col1 AS alias FROM src
 */
export function parseColumnLineage(sql: string): ParsedLineageEdge[] {
  const edges: ParsedLineageEdge[] = [];
  const statements = sql.split(/;\s*\n|;\s*$/);

  for (const stmt of statements) {
    if (stmt.trim().length < 10) continue;
    const clean = stmt
      .replace(/--[^\n]*/g, " ")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .trim();

    const { target, sources } = extractTableRefs(clean);
    if (!target || sources.length === 0) continue;

    // Extrair lista de colunas destino do INSERT INTO tgt (col1, col2)
    let targetCols: string[] = [];
    const insertColMatch = clean.match(/\bINSERT\s+(?:INTO\s+)?[\w.`"']+\s*\(([^)]+)\)/i);
    if (insertColMatch) {
      targetCols = insertColMatch[1].split(",").map(c => c.trim().replace(/[`"']/g, "").toUpperCase());
    }

    // Extrair SELECT list para mapeamento coluna→coluna
    const selectMatch = clean.match(/\bSELECT\s+([\s\S]+?)\bFROM\b/i);
    if (!selectMatch) continue;

    const selectList = selectMatch[1].trim();
    // Ignora SELECT *
    if (selectList === "*") continue;

    // Tokenizar a lista de colunas respeitando expressões com parênteses
    const columnExprs = splitSelectList(selectList);

    for (let i = 0; i < columnExprs.length; i++) {
      const expr = columnExprs[i].trim();
      if (!expr) continue;

      // Detectar alias: "expr AS alias" ou "expr alias"
      const aliasMatch = expr.match(/\bAS\s+([`"']?[\w]+[`"']?)\s*$/i)
        ?? expr.match(/\s+([`"']?[\w]+[`"']?)\s*$/);

      const targetCol = (targetCols[i]
        ?? (aliasMatch ? aliasMatch[1].replace(/[`"']/g, "") : null)
        ?? null)?.toUpperCase();

      // Detectar coluna fonte: table.column ou just column (última palavra)
      const sourceColMatch = expr
        .replace(/\bAS\s+[\w`"']+\s*$/i, "")  // remove alias
        .trim()
        .match(/(?:[\w`"']+\.)?([\w`"']+)\s*$/);

      const sourceCol = sourceColMatch ? sourceColMatch[1].replace(/[`"']/g, "").toUpperCase() : null;

      // Ignorar funções simples como COUNT(*), NOW(), etc. sem coluna fonte clara
      const isFunction = /\(/.test(expr.replace(/\bAS\b.*/i, "").trim());
      if (isFunction && !sourceCol?.match(/^[A-Z_][A-Z0-9_]*$/)) continue;

      const tgtName = target.toUpperCase();
      for (const src of sources) {
        const srcName = src.toUpperCase();
        if (srcName === tgtName) continue;

        edges.push({
          sourceName: srcName,
          targetName: tgtName,
          type: /\bGROUP\s+BY\b/i.test(clean) ? "agregado" : isFunction ? "transformado" : "direto",
          sourceColumn: sourceCol ?? undefined,
          targetColumn: targetCol ?? undefined,
          transformationRule: expr.slice(0, 200),
        });
      }
    }
  }

  return edges;
}

/** Divide a lista de colunas de um SELECT respeitando parênteses aninhados */
function splitSelectList(list: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let current = "";

  for (const ch of list) {
    if (ch === "(") { depth++; current += ch; }
    else if (ch === ")") { depth--; current += ch; }
    else if (ch === "," && depth === 0) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

// ─── dbt Manifest Parser ──────────────────────────────────────────────────────
interface DbtManifestNode {
  name: string;
  resource_type: string;
  depends_on?: { nodes?: string[] };
  config?: { materialized?: string };
  description?: string;
}

interface DbtManifest {
  nodes: Record<string, DbtManifestNode>;
  sources?: Record<string, { name: string; source_name?: string }>;
}

/**
 * Parseia um manifest.json do dbt e extrai edges de lineagem entre modelos.
 */
export function parseDbtManifest(manifestJson: string): ParsedLineageEdge[] {
  const edges: ParsedLineageEdge[] = [];
  let manifest: DbtManifest;

  try {
    manifest = JSON.parse(manifestJson);
  } catch {
    throw new Error("manifest.json inválido — não é um JSON válido.");
  }

  const nodes = manifest.nodes ?? {};

  for (const [nodeId, node] of Object.entries(nodes)) {
    if (node.resource_type !== "model" && node.resource_type !== "snapshot") continue;
    const targetName = node.name.toUpperCase();
    const deps = node.depends_on?.nodes ?? [];

    const materialized = node.config?.materialized ?? "view";
    const type: ParsedLineageEdge["type"] =
      materialized === "incremental" || materialized === "table" ? "transformado"
      : materialized === "snapshot" ? "direto"
      : "direto";

    for (const dep of deps) {
      // dep é no formato "model.project.model_name" ou "source.project.source.table"
      const parts = dep.split(".");
      const sourceName = parts[parts.length - 1].toUpperCase();
      if (sourceName === targetName) continue;
      edges.push({
        sourceName,
        targetName,
        type,
        transformationRule: node.description ? `dbt model: ${node.description}` : `dbt model: ${node.name}`,
      });
    }
  }

  return edges;
}
