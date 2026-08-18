/**
 * Registro central de adaptadores de qualidade.
 * Mapeia sourceSystem → ISourceAdapter.
 *
 * O PortalAdapter é sempre registrado como fallback.
 * Adaptadores externos podem ser registrados dinamicamente via registerAdapter().
 */
import { PortalAdapter } from "./PortalAdapter";
import { GenericMysqlAdapter } from "./GenericMysqlAdapter";
import { PostgresAdapter } from "./PostgresAdapter";
import { DatabricksAdapter } from "./DatabricksAdapter";
import type { ISourceAdapter } from "./ISourceAdapter";

export type { ISourceAdapter, AssetMeta, QualityCheckResult } from "./ISourceAdapter";

const registry = new Map<string, ISourceAdapter>();

// Adaptador do portal (sempre disponível — usa o DATABASE_URL do portal)
const portalUrl = process.env.DATABASE_URL ?? "";
if (portalUrl) {
  registry.set("portal", new PortalAdapter(portalUrl));
}

/**
 * Registra um adaptador externo.
 * Chame isto durante a inicialização do servidor quando as env vars estiverem disponíveis.
 */
export function registerAdapter(sourceSystem: string, adapter: ISourceAdapter): void {
  registry.set(sourceSystem.toLowerCase(), adapter);
  console.log(`[AdapterRegistry] Adaptador "${sourceSystem}" registrado.`);
}

/**
 * Retorna o adaptador para um sourceSystem.
 * Fallback: portal adapter (checar qualidade dos metadados do catálogo).
 */
export function getAdapter(sourceSystem: string | null | undefined): ISourceAdapter {
  if (sourceSystem) {
    const key = sourceSystem.toLowerCase();
    if (registry.has(key)) return registry.get(key)!;
  }
  // Fallback: sempre usa o PortalAdapter
  return registry.get("portal") ?? new PortalAdapter(portalUrl);
}

/**
 * Lista todos os adaptadores registrados (para exibição em UI).
 */
export function listAdapters(): Array<{ name: string; sourceSystem: string }> {
  return Array.from(registry.entries()).map(([key, adapter]) => ({
    sourceSystem: key,
    name: adapter.name,
  }));
}

// ─── Registros opcionais de adaptadores externos ──────────────────────────────

if (process.env.POSTGRES_URL) {
  registerAdapter("postgres", new PostgresAdapter({ connectionUrl: process.env.POSTGRES_URL }, "PostgreSQL"));
}
if (process.env.REDSHIFT_URL) {
  registerAdapter("redshift", new PostgresAdapter({ connectionUrl: process.env.REDSHIFT_URL }, "Redshift"));
}
if (process.env.MYSQL_EXTERNAL_URL) {
  registerAdapter("mysql", new GenericMysqlAdapter({ connectionUrl: process.env.MYSQL_EXTERNAL_URL }, "MySQL Externo"));
}

if (
  process.env.DATABRICKS_HOST &&
  process.env.DATABRICKS_HTTP_PATH &&
  (process.env.DATABRICKS_TOKEN || process.env.AZURE_KEY_VAULT_URL)
) {
  registerAdapter(
    "databricks",
    new DatabricksAdapter(
      {
        host: process.env.DATABRICKS_HOST,
        httpPath: process.env.DATABRICKS_HTTP_PATH,
        token: process.env.DATABRICKS_TOKEN,
        tokenSource: process.env.AZURE_KEY_VAULT_URL && !process.env.DATABRICKS_TOKEN ? "key_vault" : "pat",
        keyVaultUrl: process.env.AZURE_KEY_VAULT_URL,
        keyVaultSecretName: process.env.AZURE_KEY_VAULT_SECRET_NAME,
        catalog: process.env.DATABRICKS_CATALOG,
      },
      "Databricks"
    )
  );
}
