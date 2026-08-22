/**
 * DatabricksAdapter — adaptador para Databricks SQL Warehouses (Unity Catalog).
 *
 * Requer o pacote oficial: pnpm add @databricks/sql
 *
 * Configuração via variáveis de ambiente:
 *   DATABRICKS_HOST       → hostname do workspace (sem https://)
 *                           Ex: adb-123456789.1.azuredatabricks.net
 *   DATABRICKS_HTTP_PATH  → HTTP path do SQL Warehouse
 *                           Ex: /sql/1.0/warehouses/abc1234567890ef
 *   DATABRICKS_TOKEN      → Personal Access Token (PAT)
 *                           Gere em: Settings → Developer → Access Tokens
 *   DATABRICKS_CATALOG    → catálogo padrão (opcional, default: hive_metastore)
 *
 * Checks executados:
 *   1. Completude:  % de células não-NULL em todas as colunas da tabela
 *   2. Unicidade:   duplicatas detectadas via DESCRIBE TABLE EXTENDED (Unity Catalog)
 *   3. Atualidade:  coluna de timestamp (updated_at / modified_at / etc.)
 *   4. Validade:    regex customizado por coluna via regras configuradas no portal
 */

import type { ISourceAdapter, AssetMeta, QualityCheckResult } from "./ISourceAdapter";
import type { QualityRule as SelectQualityRule } from "../../drizzle/schema";

export interface DatabricksAdapterConfig {
  /** Ex: adb-123456789.1.azuredatabricks.net (sem https://) */
  host: string;
  /** Ex: /sql/1.0/warehouses/abc1234567890ef */
  httpPath: string;
  /** Personal Access Token */
  token: string;
  /** Catálogo Unity Catalog (default: hive_metastore) */
  catalog?: string;
  /** Timeout por query em ms (default: 30000) */
  queryTimeoutMs?: number;
}

export class DatabricksAdapter implements ISourceAdapter {
  readonly name: string;
  private config: DatabricksAdapterConfig;

  constructor(config: DatabricksAdapterConfig, adapterName = "Databricks") {
    this.name = adapterName;
    this.config = config;
  }

  // ─── Conexão ────────────────────────────────────────────────────────────────

  private async connect() {
    // Dynamic import — não falha se @databricks/sql não estiver instalado
    let DBSQLClient: any;
    try {
      const mod = await import("@databricks/sql");
      // O pacote pode exportar como named export, default, ou default.DBSQLClient
      DBSQLClient =
        mod.DBSQLClient ??
        (mod as any).default?.DBSQLClient ??
        (mod as any).default;
      if (typeof DBSQLClient !== "function") {
        throw new Error("DBSQLClient não é um construtor válido no pacote @databricks/sql");
      }
    } catch (importErr: any) {
      throw new Error(
        `Driver '@databricks/sql' indisponível: ${importErr?.message ?? importErr}. Execute: pnpm add @databricks/sql`
      );
    }

    const client = new DBSQLClient();
    await client.connect({
      host: this.config.host.replace(/^https?:\/\//, ""),
      path: this.config.httpPath,
      token: this.config.token,
    });
    return client;
  }

  private async withSession<T>(
    fn: (session: any) => Promise<T>
  ): Promise<T> {
    const client = await this.connect();
    // If catalog contains a dot (e.g. "psw_bricks_2.schema"), use only the first segment
    const rawCatalog = this.config.catalog ?? "hive_metastore";
    const initialCatalog = rawCatalog.includes(".") ? rawCatalog.split(".")[0] : rawCatalog;
    if (rawCatalog !== initialCatalog) {
      console.warn(`[DatabricksAdapter] Catalog env contém ponto — usando apenas "${initialCatalog}" como initialCatalog.`);
    }
    const session = await client.openSession({ initialCatalog });
    try {
      return await fn(session);
    } finally {
      await session.close().catch(() => {});
      await client.close().catch(() => {});
    }
  }

  /** Executa um statement e retorna as linhas como array de objetos. */
  private async query(session: any, sql: string): Promise<Record<string, unknown>[]> {
    const timeout = this.config.queryTimeoutMs ?? 30_000;
    // queryTimeout: número inteiro em segundos (não BigInt, não milissegundos)
    const timeoutSec = Math.ceil(timeout / 1000);
    const op = await session.executeStatement(sql, {
      runAsync: false,
      queryTimeout: timeoutSec,
    });
    const rows = await op.fetchAll();
    await op.close().catch(() => {});
    return rows as Record<string, unknown>[];
  }

  // ─── Utilitários ─────────────────────────────────────────────────────────────

  /** Escapa identificadores com backtick para evitar injeção. */
  private escapeId(name: string): string {
    return "`" + name.replace(/`/g, "``") + "`";
  }

  /**
   * Retorna o catálogo efetivo: se o env contém ponto (ex: "psw_bricks_2.schema"),
   * usa apenas o primeiro segmento como nome de catálogo válido.
   */
  private get effectiveCatalog(): string {
    const raw = this.config.catalog ?? "hive_metastore";
    return raw.includes(".") ? raw.split(".")[0] : raw;
  }

  /** Constrói referência completa catalog.schema.table. */
  private tableRef(tableName: string, schema?: string): string {
    const parts: string[] = [];
    if (this.effectiveCatalog) parts.push(this.escapeId(this.effectiveCatalog));
    if (schema) parts.push(this.escapeId(schema));
    parts.push(this.escapeId(tableName));
    return parts.join(".");
  }

  /**
   * Resolve a referência de tabela a partir dos metadados do ativo.
   * Suporta os formatos:
   *   - fullyQualifiedName: "catalog.schema.table"
   *   - externalTableName + externalSchema
   *   - name no formato "schema.table" (retornado pelo crawler)
   *   - name simples "table"
   */
  private resolveTableRef(assetMeta: AssetMeta): string {
    // 1. Prioridade: fullyQualifiedName do crawler (catalog.schema.table)
    if (assetMeta.fullyQualifiedName) {
      const parts = assetMeta.fullyQualifiedName.split(".");
      if (parts.length === 3) {
        return parts.map((p) => this.escapeId(p)).join(".");
      }
    }

    // 2. Campos explícitos externalTableName + externalSchema
    if (assetMeta.externalTableName) {
      return this.tableRef(assetMeta.externalTableName, assetMeta.externalSchema);
    }

    // 3. Nome no formato "schema.table" (padrão do crawler Databricks)
    if (assetMeta.name.includes(".")) {
      const parts = assetMeta.name.split(".");
      if (parts.length === 2) {
        // schema.table → catalog.schema.table
        return [
          this.escapeId(this.effectiveCatalog),
          this.escapeId(parts[0]),
          this.escapeId(parts[1]),
        ].join(".");
      }
      if (parts.length === 3) {
        return parts.map((p) => this.escapeId(p)).join(".");
      }
    }

    // 4. Fallback: usa name como tabela simples com catálogo configurado
    return this.tableRef(assetMeta.name, assetMeta.externalSchema);
  }

  // ─── Interface pública ───────────────────────────────────────────────────────

  async testConnection(): Promise<{ok: boolean, message?: string}> {
    try {
      await this.withSession(async (session) => {
        await this.query(session, "SELECT 1");
      });
      return { ok: true, message: "Conexão bem-sucedida" };
    } catch (e: any) {
      console.error("[DatabricksAdapter] Conexão falhou:", e.message);
      return { ok: false, message: e.message };
    }
  }

  /**
   * Executa uma query SQL arbitrária no Databricks.
   * Utilizado para auditorias de segurança avançadas (Information Schema).
   */
  async queryRaw(sql: string): Promise<Record<string, unknown>[]> {
    return this.withSession(async (session) => {
      return this.query(session, sql);
    });
  }

  async runChecks(
    _assetId: number,
    assetMeta: AssetMeta,
    rules: SelectQualityRule[] = []
  ): Promise<QualityCheckResult[]> {
    const results: QualityCheckResult[] = [];
    const tableRef = this.resolveTableRef(assetMeta);

    try {
      await this.withSession(async (session) => {
      // ── 0. Total de linhas ─────────────────────────────────────────────────
      const countRows = await this.query(session, `SELECT COUNT(*) AS total FROM ${tableRef}`);
      const total = Number(countRows[0]?.total ?? 0);

      if (total === 0) {
        results.push({
          metricName: "completude",
          score: 100,
          threshold: 80,
          details: "Tabela vazia — sem dados para validar.",
          totalRecords: 0,
        });
        return;
      }

      // ── 1. Descobrir colunas (DESCRIBE TABLE — suporta catalog.schema.table) ─
      const colRows = await this.query(session, `DESCRIBE TABLE ${tableRef}`);
      // Filtra linhas de separação/comentário (col_name começa com '#')
      const cols: string[] = colRows
        .map((r) => String(r.col_name ?? r.column_name ?? ""))
        .filter((c) => c && !c.startsWith("#"));

      // ── 1. Completude ─────────────────────────────────────────────────────
      if (cols.length > 0) {
        const nullChecks = cols
          .map((c) => `SUM(CASE WHEN ${this.escapeId(c)} IS NULL THEN 1 ELSE 0 END)`)
          .join(" + ");
        const nullRows = await this.query(
          session,
          `SELECT (${nullChecks}) AS null_count FROM ${tableRef}`
        );
        const nullCount = Number(nullRows[0]?.null_count ?? 0);
        const totalCells = total * cols.length;
        const complScore =
          totalCells === 0 ? 100 : Math.round(((totalCells - nullCount) / totalCells) * 100);
        const complThreshold =
          rules.find((r) => r.ruleType === "completude")?.threshold ?? 80;

        results.push({
          metricName: "completude",
          score: complScore,
          threshold: complThreshold,
          details: `${nullCount} de ${totalCells} células com NULL em ${total} linhas × ${cols.length} colunas.`,
          rawValue: nullCount,
          totalRecords: total,
        });
      }

      // ── 2. Unicidade — detecta PK via DESCRIBE TABLE EXTENDED ─────────────
      const uniThreshold = rules.find((r) => r.ruleType === "unicidade")?.threshold ?? 95;
      let pkCol: string | null = null;

      try {
        const descRows = await this.query(
          session,
          `DESCRIBE TABLE EXTENDED ${tableRef}`
        );
        // A saída de DESCRIBE TABLE EXTENDED tem uma seção "# Constraints"
        // com linhas no formato: PRIMARY KEY (col1, col2)
        for (const row of descRows) {
          const colName = String(row.col_name ?? "");
          const dataType = String(row.data_type ?? "");
          if (
            colName.toLowerCase().includes("primary key") ||
            dataType.toLowerCase().includes("primary key")
          ) {
            // Extrai o primeiro nome de coluna dos parênteses: PRIMARY KEY (id)
            const match = dataType.match(/\(([^,)]+)/);
            pkCol = match ? match[1].trim().replace(/`/g, "") : null;
            break;
          }
        }
      } catch {
        // DESCRIBE TABLE EXTENDED pode falhar em tabelas sem Unity Catalog — ignora
      }

      if (pkCol) {
        const safePk = this.escapeId(pkCol);
        const dupRows = await this.query(
          session,
          `SELECT COUNT(*) AS duplicates FROM (
             SELECT ${safePk}, COUNT(*) AS cnt FROM ${tableRef}
             GROUP BY ${safePk} HAVING COUNT(*) > 1
           )`
        );
        const dups = Number(dupRows[0]?.duplicates ?? 0);
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
        const safeTs = this.escapeId(foundTs);
        const maxRows = await this.query(
          session,
          `SELECT MAX(${safeTs}) AS last_update FROM ${tableRef}`
        );
        const rawDate = maxRows[0]?.last_update;
        const lastUpdate = rawDate ? new Date(String(rawDate)) : null;
        const daysSince = lastUpdate
          ? Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        const actualScore =
          daysSince === null ? 50
          : daysSince <= 1 ? 100
          : daysSince <= 7 ? 85
          : daysSince <= 30 ? 60
          : 20;

        results.push({
          metricName: "atualidade",
          score: actualScore,
          threshold: actualThreshold,
          details:
            daysSince === null
              ? `Coluna "${foundTs}" sem data detectável.`
              : `Última atualização: ${lastUpdate?.toLocaleDateString("pt-BR")} (${daysSince} dias atrás).`,
          rawValue: daysSince ?? undefined,
          totalRecords: total,
        });
      }

      // ── 4. Validade por regex (regras customizadas) ───────────────────────
      // Databricks usa RLIKE em vez de ~ (PostgreSQL)
      const regexRules = rules.filter(
        (r) => r.ruleType === "regex" && r.columnName && r.customPattern
      );
      for (const rule of regexRules) {
        if (!cols.includes(rule.columnName!)) continue;
        const safeCol = this.escapeId(rule.columnName!);
        // Escapa aspas simples no padrão regex para segurança
        const safePattern = rule.customPattern!.replace(/'/g, "\\'");
        try {
          const invalidRows = await this.query(
            session,
            `SELECT COUNT(*) AS invalid FROM ${tableRef}
             WHERE ${safeCol} IS NOT NULL AND ${safeCol} NOT RLIKE '${safePattern}'`
          );
          const invalid = Number(invalidRows[0]?.invalid ?? 0);
          const validScore =
            total === 0 ? 100 : Math.round(((total - invalid) / total) * 100);
          const validThreshold = rule.threshold ?? 90;

          results.push({
            metricName: `validade_${rule.columnName}`,
            score: validScore,
            threshold: validThreshold,
            details: `${invalid} de ${total} linhas violam o padrão regex na coluna "${rule.columnName}".`,
            rawValue: invalid,
            totalRecords: total,
          });
        } catch {
          // Ignora erros em regras de regex individuais
        }
      }
    });
    } catch (err: any) {
      // Falha de conexão ao Databricks — retorna score 0 com detalhe do erro
      const errMsg = err?.message ?? String(err ?? "erro desconhecido");
      console.warn(`[DatabricksAdapter] Falha ao executar checks em "${assetMeta.name}": ${errMsg}`);
      console.warn(`[DatabricksAdapter] tableRef resolvido: ${tableRef}`);
      // Classifica o tipo de erro para facilitar diagnóstico
      const isTableNotFound = /TABLE_OR_VIEW_NOT_FOUND|does not exist|not found/i.test(errMsg);
      const isCatalogError = /INVALID_PARAMETER_VALUE|catalog|schema/i.test(errMsg);
      const detailMsg = isTableNotFound
        ? `Tabela não encontrada: ${tableRef}. Verifique se o catálogo/schema está correto no conector.`
        : isCatalogError
        ? `Erro de catálogo ao acessar ${tableRef}: ${errMsg}`
        : `Erro ao conectar ao Databricks: ${errMsg}`;
      results.push({
        metricName: "completude",
        score: 0,
        threshold: 80,
        details: detailMsg,
        totalRecords: 0,
      });
    }

    console.log(`[DatabricksAdapter] runChecks "${assetMeta.name}" concluído — ${results.length} resultado(s): ${results.map(r => `${r.metricName}:${r.score}`).join(", ") || "(vazio)"}`);
    return results;
  }
}
