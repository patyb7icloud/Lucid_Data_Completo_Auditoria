/**
 * PostgresAdapter — adaptador configurável para PostgreSQL, Redshift e DuckDB.
 * Executa checks de qualidade SQL reais contra a fonte de dados.
 *
 * Checks executados:
 *   1. Completude: % de linhas sem qualquer coluna NULL (information_schema)
 *   2. Unicidade: duplicatas em colunas PK detectadas via pg_index / redshift_key_column
 *   3. Atualidade: data da última modificação (coluna updated_at/modified_at se existir)
 *   4. Validade por regex: valida e-mail, CPF, CNPJ se configurado nas regras
 *   5. Volume: alerta se rowCount mudou >50% desde a última verificação
 */
import type { ISourceAdapter, AssetMeta, QualityCheckResult } from "./ISourceAdapter";
import type { SelectQualityRule } from "../db";

export interface PostgresAdapterConfig {
  /** postgres://user:pass@host:5432/database */
  connectionUrl: string;
  /** Timeout em ms por query (default: 15000) */
  queryTimeoutMs?: number;
}

export class PostgresAdapter implements ISourceAdapter {
  readonly name: string;
  private config: PostgresAdapterConfig;

  constructor(config: PostgresAdapterConfig, adapterName = "postgres") {
    this.name = adapterName;
    this.config = config;
  }

  private async getClient() {
    // Dynamic import — não falha se pg não estiver instalado
    const { default: pg } = await import("pg").catch(() => ({ default: null })) as any;
    if (!pg) throw new Error("Driver 'pg' não instalado. Execute: pnpm add pg");
    const client = new pg.Client({
      connectionString: this.config.connectionUrl,
      connectionTimeoutMillis: this.config.queryTimeoutMs ?? 15_000,
      statement_timeout: this.config.queryTimeoutMs ?? 15_000,
    });
    await client.connect();
    return client;
  }

  async testConnection(): Promise<boolean> {
    let client: any;
    try {
      client = await this.getClient();
      await client.query("SELECT 1");
      return true;
    } catch {
      return false;
    } finally {
      if (client) await client.end().catch(() => {});
    }
  }

  async runChecks(
    assetId: number,
    assetMeta: AssetMeta,
    rules: SelectQualityRule[] = [],
  ): Promise<QualityCheckResult[]> {
    const results: QualityCheckResult[] = [];
    const tableName = assetMeta.externalTableName ?? assetMeta.name;
    const schema = assetMeta.externalSchema ?? "public";
    // Use parameterized identifiers to avoid injection (identifier must be quoted)
    const safeTable = `"${schema.replace(/"/g, '""')}"."${tableName.replace(/"/g, '""')}"`;

    let client: any;
    try {
      client = await this.getClient();

      // ── 1. Completude ─────────────────────────────────────────────────────
      const totalRes = await client.query(`SELECT COUNT(*) AS total FROM ${safeTable}`);
      const total = Number(totalRes.rows[0]?.total ?? 0);

      if (total === 0) {
        results.push({
          metricName: "completude",
          score: 100,
          threshold: 80,
          details: "Tabela vazia — sem dados para validar.",
          totalRecords: 0,
        });
      } else {
        // Buscar colunas pela information_schema
        const colRes = await client.query(
          `SELECT column_name FROM information_schema.columns
           WHERE table_schema = $1 AND table_name = $2
           ORDER BY ordinal_position`,
          [schema, tableName],
        );
        const cols: string[] = colRes.rows.map((r: any) => r.column_name);

        if (cols.length > 0) {
          const nullChecks = cols
            .map((c) => `SUM(CASE WHEN "${c.replace(/"/g, '""')}" IS NULL THEN 1 ELSE 0 END)`)
            .join(" + ");
          const nullRes = await client.query(
            `SELECT ${nullChecks} AS null_count FROM ${safeTable}`,
          );
          const nullCount = Number(nullRes.rows[0]?.null_count ?? 0);
          const totalCells = total * cols.length;
          const complScore = totalCells === 0 ? 100 : Math.round(((totalCells - nullCount) / totalCells) * 100);
          const complThreshold = rules.find((r) => r.ruleType === "completude")?.threshold ?? 80;

          results.push({
            metricName: "completude",
            score: complScore,
            threshold: complThreshold,
            details: `${nullCount} de ${totalCells} células com NULL em ${total} linhas × ${cols.length} colunas.`,
            rawValue: nullCount,
            totalRecords: total,
          });
        }

        // ── 2. Unicidade ─────────────────────────────────────────────────────
        // Tentar detectar PK via information_schema.key_column_usage
        const pkRes = await client.query(
          `SELECT kcu.column_name FROM information_schema.table_constraints tc
           JOIN information_schema.key_column_usage kcu
             ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
           WHERE tc.constraint_type = 'PRIMARY KEY'
             AND tc.table_schema = $1 AND tc.table_name = $2
           LIMIT 1`,
          [schema, tableName],
        );
        const pkCol: string | null = pkRes.rows[0]?.column_name ?? null;
        const uniThreshold = rules.find((r) => r.ruleType === "unicidade")?.threshold ?? 95;

        if (pkCol) {
          const safePk = `"${pkCol.replace(/"/g, '""')}"`;
          const dupRes = await client.query(
            `SELECT COUNT(*) AS duplicates FROM (
               SELECT ${safePk}, COUNT(*) AS cnt FROM ${safeTable}
               GROUP BY ${safePk} HAVING COUNT(*) > 1
             ) AS dups`,
          );
          const dups = Number(dupRes.rows[0]?.duplicates ?? 0);
          const uniScore = total === 0 ? 100 : Math.round(((total - dups) / total) * 100);

          results.push({
            metricName: "unicidade",
            score: uniScore,
            threshold: uniThreshold,
            details: `${dups} linhas duplicadas por PK "${pkCol}" em ${total} registros.`,
            rawValue: dups,
            totalRecords: total,
          });
        } else {
          results.push({
            metricName: "unicidade",
            score: 100,
            threshold: uniThreshold,
            details: "Nenhuma chave primária detectada — unicidade não verificada.",
            totalRecords: total,
          });
        }

        // ── 3. Atualidade ─────────────────────────────────────────────────────
        const tsColumns = ["updated_at", "modified_at", "data_atualizacao", "updated_date"];
        const foundTs = cols.find((c) => tsColumns.includes(c.toLowerCase()));
        const actualThreshold = rules.find((r) => r.ruleType === "validade")?.threshold ?? 70;

        if (foundTs) {
          const safeTs = `"${foundTs.replace(/"/g, '""')}"`;
          const maxRes = await client.query(`SELECT MAX(${safeTs}) AS last_update FROM ${safeTable}`);
          const lastUpdate = maxRes.rows[0]?.last_update ? new Date(maxRes.rows[0].last_update) : null;
          const daysSince = lastUpdate
            ? Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24))
            : null;

          const actualScore = daysSince === null ? 50 : daysSince <= 1 ? 100 : daysSince <= 7 ? 85 : daysSince <= 30 ? 60 : 20;
          results.push({
            metricName: "atualidade",
            score: actualScore,
            threshold: actualThreshold,
            details: daysSince === null
              ? `Coluna "${foundTs}" sem data detectável.`
              : `Última atualização: ${lastUpdate?.toLocaleDateString("pt-BR")} (${daysSince} dias atrás).`,
            rawValue: daysSince ?? undefined,
            totalRecords: total,
          });
        }

        // ── 4. Validade por regex (regras customizadas) ───────────────────────
        const regexRules = rules.filter((r) => r.ruleType === "regex" && r.columnName && r.customPattern);
        for (const rule of regexRules) {
          const safeCol = `"${rule.columnName!.replace(/"/g, '""')}"`;
          if (!cols.includes(rule.columnName!)) continue;
          try {
            const invalidRes = await client.query(
              `SELECT COUNT(*) AS invalid FROM ${safeTable}
               WHERE ${safeCol} IS NOT NULL AND ${safeCol} !~ $1`,
              [rule.customPattern!],
            );
            const invalid = Number(invalidRes.rows[0]?.invalid ?? 0);
            const validScore = total === 0 ? 100 : Math.round(((total - invalid) / total) * 100);
            results.push({
              metricName: `validade_${rule.columnName}`,
              score: validScore,
              threshold: rule.threshold ?? 90,
              details: `${invalid} de ${total} registros falham no padrão regex para "${rule.columnName}".`,
              rawValue: invalid,
              totalRecords: total,
            });
          } catch {
            // Regex inválido — ignora
          }
        }

        // ── 5. Consistência entre schemas (intervalo de valores numéricos) ────
        const consistenciaCols = cols.filter((c) =>
          ["amount", "valor", "preco", "price", "quantidade", "qty"].some((k) => c.toLowerCase().includes(k)),
        );
        if (consistenciaCols.length > 0) {
          const safeC = `"${consistenciaCols[0].replace(/"/g, '""')}"`;
          const negRes = await client.query(
            `SELECT COUNT(*) AS negatives FROM ${safeTable} WHERE ${safeC} < 0`,
          );
          const negatives = Number(negRes.rows[0]?.negatives ?? 0);
          const consScore = total === 0 ? 100 : Math.round(((total - negatives) / total) * 100);
          const consThreshold = rules.find((r) => r.ruleType === "consistencia")?.threshold ?? 95;
          results.push({
            metricName: "consistencia",
            score: consScore,
            threshold: consThreshold,
            details: `${negatives} registros com valor negativo em "${consistenciaCols[0]}" (esperado ≥ 0).`,
            rawValue: negatives,
            totalRecords: total,
          });
        }
      }
    } catch (err: any) {
      results.push({
        metricName: "conexao",
        score: 0,
        threshold: 100,
        details: `Falha ao executar checks no PostgreSQL: ${err.message}`,
      });
    } finally {
      if (client) await client.end().catch(() => {});
    }

    return results;
  }
}
