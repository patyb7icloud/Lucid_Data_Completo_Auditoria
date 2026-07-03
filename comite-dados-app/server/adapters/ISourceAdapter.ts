import type { SelectQualityRule } from "../db";

/**
 * Interface base para todos os adaptadores de fonte de dados.
 * Cada adaptador implementa checks de qualidade específicos da sua fonte.
 */
export interface QualityCheckResult {
  metricName: string;
  score: number;         // 0-100
  threshold: number;     // limiar de qualidade (abaixo = falha)
  details: string;       // descrição humana do resultado
  rawValue?: number;     // valor bruto (ex: qtde de nulos)
  totalRecords?: number; // total avaliado
}

export interface ISourceAdapter {
  /** Nome identificador do adaptador (ex: "portal", "mysql:SAP") */
  readonly name: string;

  /**
   * Testa a conectividade com a fonte de dados.
   * Retorna true se conectou com sucesso.
   */
  testConnection(): Promise<boolean>;

  /**
   * Executa todos os checks de qualidade para um ativo específico.
   * @param assetId ID interno do ativo no portal
   * @param assetMeta Metadados do ativo (nome da tabela na fonte, etc.)
   * @param rules Regras customizadas configuradas para este ativo
   */
  runChecks(assetId: number, assetMeta: AssetMeta, rules?: SelectQualityRule[]): Promise<QualityCheckResult[]>;
}

export interface AssetMeta {
  id: number;
  name: string;
  type: string;
  sourceSystem: string | null;
  ownerId: number | null;
  stewardId: number | null;
  qualityScore: number | null;
  /** Nome da tabela/view na fonte externa (pode diferir do nome no portal) */
  externalTableName?: string;
  /** Schema/database na fonte externa */
  externalSchema?: string;
  /** Nome completo qualificado: catalog.schema.table (preenchido pelo crawler) */
  fullyQualifiedName?: string | null;
}
