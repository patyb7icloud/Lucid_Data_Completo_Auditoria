import { MetadataCollectorService } from './server/metadataCollector';
import * as db from './server/db';
import { resolveDatabricksToken } from './server/akvResolver';
import { dataLineage } from './drizzle/schema';

async function run() {
  console.log("Iniciando extração rápida de linhagem real do Databricks...");
  const collector = new MetadataCollectorService();
  try {
    const configs = await db.getConnectorConfigs();
    const config = configs.find(c => c.connectorType?.toLowerCase().includes('databricks'));
    
    if (!config) throw new Error("Conector do Databricks não encontrado");

    const cfg = typeof config.configJson === 'string' ? JSON.parse(config.configJson) : config.configJson;
    
    const resolvedToken = await resolveDatabricksToken(cfg).catch(() => null);
    const effectiveCfg = resolvedToken ? { ...cfg, token: resolvedToken } : cfg;

    const result = await collector.crawlDatabricks(effectiveCfg);
    
    if (result.lineageEdges && result.lineageEdges.length > 0) {
      const instance = await db.getDb();
      if(instance) {
         await instance.delete(dataLineage);
      }
      
      const res = await db.importLineageEdges(result.lineageEdges);
      console.log(`Linhagem real importada do Databricks: ${res.imported} arestas (${res.skipped} ignoradas)!`);
    } else {
      console.log("Nenhuma linhagem real encontrada no Databricks (ou permissão negada).");
    }
    
  } catch (err) {
    console.error("Erro:", err);
  }
  process.exit(0);
}

run();
