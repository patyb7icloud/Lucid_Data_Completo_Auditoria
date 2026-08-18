import { ENV } from "../_core/env";
import { getDb, getConnectorConfigs } from "../db";
import { mlModels } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { resolveDatabricksToken } from "../akvResolver";

export async function syncDatabricksModels() {
  if (!ENV.databricksMlCatalogs) {
    console.log("[MLOps Sync] Variável DATABRICKS_ML_CATALOGS não configurada. Ignorando sincronização.");
    return;
  }

  const db = await getDb();
  if (!db) {
    console.warn("[MLOps Sync] Banco de dados não disponível.");
    return;
  }

  const allConnectors = await getConnectorConfigs();
  const dbxConnector = allConnectors.find(c => c.connectorType?.toLowerCase().includes('databricks'));

  if (!dbxConnector) {
    console.warn("[MLOps Sync] Nenhum conector do Databricks encontrado no banco de dados.");
    return;
  }

  const config = dbxConnector.configJson as any;
  const host = config.host;
  const path = config.httpPath;
  const token = await resolveDatabricksToken(config);

  if (!host || !path || !token) {
    console.warn("[MLOps Sync] Falha ao resolver credenciais do conector Databricks.");
    return;
  }

  console.log(`[MLOps Sync] Iniciando busca nos catálogos: ${ENV.databricksMlCatalogs}`);

  let urlBase = host.trim().replace(/\/$/, "");
  if (!urlBase.startsWith("http")) urlBase = "https://" + urlBase;

  const schemas = ENV.databricksMlCatalogs.split(",").map(s => s.trim()).filter(Boolean);

  for (const target of schemas) {
    console.log(`[MLOps Sync] Buscando modelos em: ${target}`);
    try {
      const [catalog, schema] = target.split(".");
      
      if (catalog && schema) {
        const url = `${urlBase}/api/2.1/unity-catalog/models?catalog_name=${encodeURIComponent(catalog)}&schema_name=${encodeURIComponent(schema)}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!res.ok) {
          console.warn(`[MLOps Sync] REST API erro ${res.status}: ${await res.text()}`);
          continue;
        }
        
        const data = await res.json();
        const models = data.registered_models || [];

        for (const row of models) {
          const modelName = String(row.name);
          const description = row.comment ? String(row.comment) : undefined;
          const ownerName = row.owner ? String(row.owner) : "Databricks Unity Catalog";
          
          // Verificar se já existe no banco
          const [existing] = await db.select().from(mlModels).where(eq(mlModels.name, modelName));
          
          if (existing) {
            // Update
            await db.update(mlModels).set({
              description: description ?? existing.description,
              updatedAt: new Date(),
            }).where(eq(mlModels.id, existing.id));
            console.log(`[MLOps Sync] Modelo atualizado: ${modelName}`);
          } else {
            // Insert
            await db.insert(mlModels).values({
              name: modelName,
              description,
              modelType: "other",
              framework: "other",
              status: "development",
              ownerName: ownerName,
            });
            console.log(`[MLOps Sync] Novo modelo cadastrado: ${modelName}`);
          }
        }
      }
    } catch (err: any) {
      console.warn(`[MLOps Sync] Falha ao buscar modelos em ${target}: ${err.message}`);
    }
  }
}
