/**
 * Testa runChecks do DatabricksAdapter diretamente para assetId=10.
 */
import { config } from "dotenv";
config();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (esperado: postgresql://user:pass@host:5432/comite_dados)");
  process.exit(1);
}

const { DatabricksAdapter } = await import("./server/adapters/DatabricksAdapter.js");

const adapter = new DatabricksAdapter({
  host: process.env.DATABRICKS_HOST,
  httpPath: process.env.DATABRICKS_HTTP_PATH,
  token: process.env.DATABRICKS_TOKEN,
  catalog: process.env.DATABRICKS_CATALOG,
  queryTimeoutMs: 30_000,
});

const assetMeta = {
  id: 10,
  name: "atendimento_satisfacao.dim_canal",
  type: "table",
  sourceSystem: "Databricks",
  ownerId: null,
  stewardId: null,
  qualityScore: 0,
  fullyQualifiedName: "casas_bahia_mvp.atendimento_satisfacao.dim_canal",
};

console.log("[Test] Chamando runChecks para asset:", assetMeta.name);
console.log("[Test] fullyQualifiedName:", assetMeta.fullyQualifiedName);

try {
  const results = await adapter.runChecks(10, assetMeta, []);
  console.log(`[Test] runChecks retornou ${results.length} resultado(s):`);
  results.forEach(r => console.log(`  - ${r.metricName}: score=${r.score}, threshold=${r.threshold}`));
  console.log("[Test] Detalhes:", JSON.stringify(results, null, 2));
} catch (err) {
  console.error("[Test] ERRO em runChecks:", err.message);
  console.error(err.stack);
}
