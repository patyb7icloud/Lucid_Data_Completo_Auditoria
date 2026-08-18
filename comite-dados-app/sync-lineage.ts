import { MetadataCollectorService } from './server/metadataCollector';

async function run() {
  console.log("Iniciando sincronização de linhagem real do Databricks...");
  const collector = new MetadataCollectorService();
  try {
    await collector.syncAll();
    console.log("Sincronização concluída.");
  } catch (err) {
    console.error("Erro:", err);
  }
  process.exit(0);
}

run();
