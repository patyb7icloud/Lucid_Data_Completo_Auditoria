// Teste direto de createDataQualityCheck via Drizzle ORM
// Rodar com: node_modules\.bin\tsx test-quality-insert.ts

import * as dotenv from "dotenv";
dotenv.config();

// Garante DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (esperado: postgresql://user:pass@host:5432/comite_dados)");
  process.exit(1);
}

import { createDataQualityCheck, getDb } from "./server/db";

async function main() {
  console.log("[Test] Iniciando teste de createDataQualityCheck...");
  console.log("[Test] DATABASE_URL:", process.env.DATABASE_URL);

  const db = await getDb();
  if (!db) {
    console.error("[Test] ERRO: getDb() retornou null — DATABASE_URL não configurado?");
    process.exit(1);
  }
  console.log("[Test] getDb() OK — Drizzle instance obtida");

  try {
    console.log("[Test] Chamando createDataQualityCheck para assetId=10...");
    const result = await createDataQualityCheck({
      assetId: 10,
      metricName: "teste_direto",
      score: 99,
      threshold: 80,
      status: "sucesso",
      details: "Teste direto via script",
      lastRunAt: new Date(),
    });
    console.log("[Test] INSERT bem-sucedido! Resultado:", result);
  } catch (err: any) {
    console.error("[Test] ERRO no insert:", err?.message ?? err);
    console.error("[Test] Stack:", err?.stack);
  }

  process.exit(0);
}

main().catch(e => {
  console.error("[Test] Erro fatal:", e);
  process.exit(1);
});
