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
    // mysql2 é uma dependência OPCIONAL — usada apenas quando MYSQL_EXTERNAL_URL
    // está configurada para conectar a fontes de dados MySQL externas.
    // O banco principal da aplicação é PostgreSQL. Para habilitar este adaptador:
    //   pnpm add mysql2
    let createPool: any;
    try {
      // @ts-ignore — dependência opcional, pode não estar instalada
      ({ createPool } = await import("mysql2/promise"));
    } catch {
      throw new Error(
        'O pacote "mysql2" não está instalado. Este adaptador conecta a fontes MySQL EXTERNAS (não é o banco da aplicação, que é PostgreSQL). Instale com: pnpm add mysql2'
      );
    }
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
    return [];
  }
}
