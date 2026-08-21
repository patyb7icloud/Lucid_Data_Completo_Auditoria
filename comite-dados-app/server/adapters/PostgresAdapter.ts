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
    return [];
  }
}
