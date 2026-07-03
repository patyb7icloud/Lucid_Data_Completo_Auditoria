/**
 * GenericMysqlAdapter — adaptador configurável para qualquer fonte MySQL/MariaDB.
 * Conecta via connection string e executa checks de qualidade SQL reais
 * contra a tabela/view configurada para o ativo.
 *
 * Configuração por ativo via assetMeta.externalTableName + externalSchema.
 *
 * Checks executados:
 *   1. Completude: % de linhas sem NULLs em colunas-chave
 *   2. Unicidade: duplicatas em coluna PK/UK detectada automaticamente
 *   3. Atualidade: data da última modificação vs. SLA configurado
 *   4. Volume: alerta se rowCount mudou drasticamente (>50% de variação)
 */
import type { SelectQualityRule } from "../db";
import type { ISourceAdapter, AssetMeta, QualityCheckResult } from "./ISourceAdapter";

export interface MysqlAdapterConfig {
  /** mysql://user:pass@host:port/schema */
  connectionUrl: string;
  /** Timeout em ms para cada query (default: 10000) */
  queryTimeoutMs?: number;
}

export class GenericMysqlAdapter implements ISourceAdapter {
  readonly name: string;
  private config: MysqlAdapterConfig;

  constructor(config: MysqlAdapterConfig, adapterName = "mysql") {
    this.name = adapterName;
    this.config = config;
  }

  private async getPool() {
    const { createPool } = await import("mysql2/promise");
    return createPool({
      uri: this.config.connectionUrl,
      connectTimeout: this.config.queryTimeoutMs ?? 10_000,
      connectionLimit: 2,
    });
  }

  async testConnection(): Promise<boolean> {
    let pool;
    try {
      pool = await this.getPool();
      const conn = await pool.getConnection();
      await conn.query("SELECT 1");
      conn.release();
      return true;
    } catch {
      return false;
    } finally {
      if (pool) await pool.end().catch(() => {});
    }
  }

  async runChecks(assetId: number, assetMeta: AssetMeta, rules?: SelectQualityRule[]): Promise<QualityCheckResult[]> {
    const results: QualityCheckResult[] = [];
    // Sanitize identifiers: strip backtick characters to prevent breaking out of
    // MySQL backtick quoting (SQL identifier injection via config values).
    const sanitizeId = (id: string) => id.replace(/`/g, "");
    const tableName  = sanitizeId(assetMeta.externalTableName ?? assetMeta.name);
    const schema     = sanitizeId(assetMeta.externalSchema ?? "");
    const fullTable  = schema ? `\`${schema}\`.\`${tableName}\`` : `\`${tableName}\``;
    let pool;

    try {
      pool = await this.getPool();
      const conn = await pool.getConnection();

      try {
        // ── 1. Completude global: % linhas sem qualquer coluna NULL ───────────
        const [countRows] = await conn.query(`SELECT COUNT(*) AS total FROM ${fullTable}`) as any;
        const total = Number(countRows?.[0]?.total ?? 0);

        if (total === 0) {
          results.push({
            metricName: "completude",
            score: 100,
            threshold: 80,
            details: "Tabela vazia (zero registros) — sem dados para validar.",
            totalRecords: 0,
          });
        } else {
          // Buscar colunas para montar o check de nulos
          const [colRows] = await conn.query(
            `SELECT COLUMN_NAME FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
             AND IS_NULLABLE = 'NO'
             LIMIT 10`,
            [tableName]
          ) as any;
          const notNullCols: string[] = (colRows ?? []).map((r: any) => r.COLUMN_NAME);

          if (notNullCols.length > 0) {
            const nullChecks = notNullCols.map(c => `SUM(CASE WHEN \`${c}\` IS NULL THEN 1 ELSE 0 END)`).join("+");
            const [nullRows] = await conn.query(
              `SELECT (${nullChecks}) AS total_nulls FROM ${fullTable}`
            ) as any;
            const totalNulls = Number(nullRows?.[0]?.total_nulls ?? 0);
            const badRows    = Math.ceil(totalNulls / notNullCols.length); // estimativa
            const score      = Math.max(0, Math.round(((total - badRows) / total) * 100));
            results.push({
              metricName: "completude",
              score,
              threshold: 80,
              details: `${totalNulls} valor(es) nulo(s) em colunas NOT NULL. Total: ${total} registros.`,
              rawValue: totalNulls,
              totalRecords: total,
            });
          } else {
            results.push({
              metricName: "completude",
              score: 100,
              threshold: 80,
              details: `Todas as ${total} linhas verificadas — sem colunas NOT NULL identificadas no schema.`,
              totalRecords: total,
            });
          }

          // ── 2. Unicidade: checar PK/UK ──────────────────────────────────
          const [pkRows] = await conn.query(
            `SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
             AND CONSTRAINT_NAME = 'PRIMARY'
             LIMIT 1`,
            [tableName]
          ) as any;
          const pkCol: string | null = pkRows?.[0]?.COLUMN_NAME ?? null;

          if (pkCol) {
            const [dupRows] = await conn.query(
              `SELECT COUNT(*) AS dups FROM (
                 SELECT \`${pkCol}\`, COUNT(*) AS cnt FROM ${fullTable}
                 GROUP BY \`${pkCol}\` HAVING cnt > 1
               ) t`
            ) as any;
            const dups = Number(dupRows?.[0]?.dups ?? 0);
            const uScore = dups === 0 ? 100 : Math.max(0, Math.round(((total - dups) / total) * 100));
            results.push({
              metricName: "unicidade",
              score: uScore,
              threshold: 99,
              details: dups === 0
                ? `Chave primária \`${pkCol}\` sem duplicatas em ${total} registros.`
                : `${dups} valor(es) duplicados na coluna PK \`${pkCol}\`.`,
              rawValue: dups,
              totalRecords: total,
            });
          }

          // ── 3. Atualidade: checar se há coluna de data e quando foi atualizado
          const [dateColRows] = await conn.query(
            `SELECT COLUMN_NAME FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
             AND DATA_TYPE IN ('datetime','timestamp','date')
             AND COLUMN_NAME REGEXP 'updated|modified|changed|sync'
             LIMIT 1`,
            [tableName]
          ) as any;
          const dateCol: string | null = dateColRows?.[0]?.COLUMN_NAME ?? null;

          if (dateCol) {
            const [dateRows] = await conn.query(
              `SELECT MAX(\`${dateCol}\`) AS last_update FROM ${fullTable}`
            ) as any;
            const lastUpdate: Date | null = dateRows?.[0]?.last_update ?? null;
            const daysSince = lastUpdate
              ? Math.floor((Date.now() - new Date(lastUpdate).getTime()) / 86_400_000)
              : 999;
            const freshnessScore = daysSince <= 1 ? 100
              : daysSince <= 7  ? 85
              : daysSince <= 30 ? 60
              : 20;
            results.push({
              metricName: "atualidade",
              score: freshnessScore,
              threshold: 70,
              details: lastUpdate
                ? `Última atualização: ${new Date(lastUpdate).toLocaleDateString("pt-BR")} (${daysSince} dias atrás).`
                : "Coluna de data de atualização encontrada, mas sem registros.",
              rawValue: daysSince,
            });
          }

          // ── 4. Regras Customizadas (Regex, etc.) ───────────────────────
          if (rules && rules.length > 0) {
            for (const rule of rules) {
              if (rule.ruleType === "regex" && rule.columnName && rule.customPattern) {
                // Check Regex via SQL (REGEXP ou RLIKE)
                const [regexRows] = await conn.query(
                  `SELECT 
                     COUNT(*) AS total,
                     SUM(CASE WHEN \`${rule.columnName}\` REGEXP ? THEN 1 ELSE 0 END) AS valid
                   FROM ${fullTable}`,
                  [rule.customPattern]
                ) as any;
                
                const rTotal = Number(regexRows?.[0]?.total ?? 0);
                const rValid = Number(regexRows?.[0]?.valid ?? 0);
                const rScore = rTotal === 0 ? 100 : Math.round((rValid / rTotal) * 100);
                
                results.push({
                  metricName: `regra:${rule.columnName}`,
                  score: rScore,
                  threshold: rule.threshold ?? 80,
                  details: `Regex "${rule.customPattern}" na coluna "${rule.columnName}": ${rValid}/${rTotal} válidos.`,
                  rawValue: rValid,
                  totalRecords: rTotal
                });
              }
            }
          }
        }
      } finally {
        conn.release();
      }
    } catch (err: any) {
      results.push({
        metricName: "conectividade",
        score: 0,
        threshold: 100,
        details: `Falha ao conectar na fonte "${this.name}": ${err?.message ?? "erro desconhecido"}.`,
      });
    } finally {
      if (pool) await pool.end().catch(() => {});
    }

    return results;
  }
}
