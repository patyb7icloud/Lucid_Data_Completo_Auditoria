/**
 * Testa o fluxo completo: runChecksForAsset → createDataQualityCheck
 * para um ativo Databricks (id=10).
 */
import * as dotenv from "dotenv";
dotenv.config();

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "mysql://root@127.0.0.1:3306/comite_dados";
}

// Import server modules
const { QualityEngineService } = await import("./server/qualityEngine.js");
const mysql = await import("mysql2/promise");

async function getCheckCount() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [rows] = await conn.query("SELECT COUNT(*) as cnt FROM data_quality_checks WHERE assetId=10 AND metricName!='teste_direto'");
  await conn.end();
  return rows[0].cnt;
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
