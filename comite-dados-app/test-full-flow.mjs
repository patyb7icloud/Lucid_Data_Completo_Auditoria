/**
 * Testa o fluxo completo: runChecksForAsset → createDataQualityCheck
 * para um ativo Databricks (id=10).
 * Requer: DATABASE_URL no formato postgresql://user:pass@host:5432/dbname
 */
import * as dotenv from "dotenv";
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

// Import server modules
const { QualityEngineService } = await import("./server/qualityEngine.js");
const pg = await import("pg");

async function getCheckCount() {
  const client = new pg.default.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const { rows } = await client.query(
    "SELECT COUNT(*) as cnt FROM data_quality_checks WHERE \"assetId\"=10 AND \"metricName\"!='teste_direto'"
  );
  await client.end();
  return Number(rows[0].cnt);
}

const before = await getCheckCount();
console.log(`[Test] Entries em data_quality_checks para assetId=10 ANTES: ${before}`);

console.log("[Test] Executando runChecksForAsset(10)...");
const engine = new QualityEngineService();
try {
  await engine.runChecksForAsset(10);
  console.log("[Test] runChecksForAsset(10) concluído!");
} catch (err) {
  console.error("[Test] ERRO em runChecksForAsset:", err.message);
}

const after = await getCheckCount();
console.log(`[Test] Entries em data_quality_checks para assetId=10 DEPOIS: ${after}`);
console.log(`[Test] Delta: +${after - before} novos registros`);

process.exit(0);
