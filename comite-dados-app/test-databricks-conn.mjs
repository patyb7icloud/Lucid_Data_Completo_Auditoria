/**
 * Teste rápido de conexão Databricks com timeout explícito.
 * Execução: node test-databricks-conn.mjs
 */
import { config } from "dotenv";
config();

const HOST = process.env.DATABRICKS_HOST ?? "adb-2338706343670020.0.azuredatabricks.net";
const HTTP_PATH = process.env.DATABRICKS_HTTP_PATH ?? "/sql/1.0/warehouses/2ee65d6f13ec811a";
const TOKEN = process.env.DATABRICKS_TOKEN ?? "dapi76e5ef3aae99c55fb9a46acf39a7af62-2";
const CATALOG = process.env.DATABRICKS_CATALOG ?? "casas_bahia_mvp";

console.log(`[Test] Conectando a ${HOST}...`);
console.log(`[Test] HTTP Path: ${HTTP_PATH}`);
console.log(`[Test] Catálogo: ${CATALOG}`);
console.log(`[Test] Token: ${TOKEN.slice(0, 8)}...`);

const TIMEOUT_MS = 30_000;

async function testConnection() {
  let mod;
  try {
    mod = await import("@databricks/sql");
  } catch (e) {
    console.error("[Test] ERRO: @databricks/sql não instalado:", e.message);
    process.exit(1);
  }

  const DBSQLClient =
    mod.DBSQLClient ??
    mod.default?.DBSQLClient ??
    mod.default;

  if (typeof DBSQLClient !== "function") {
    console.error("[Test] ERRO: DBSQLClient não é um construtor válido");
    process.exit(1);
  }

  console.log(`[Test] DBSQLClient encontrado — tentando conectar (timeout: ${TIMEOUT_MS}ms)...`);

  const client = new DBSQLClient();

  const connectPromise = client.connect({
    host: HOST.replace(/^https?:\/\//, ""),
    path: HTTP_PATH,
    token: TOKEN,
  });

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout de conexão após ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
  );

  try {
    await Promise.race([connectPromise, timeoutPromise]);
    console.log("[Test] Conexão estabelecida!");
  } catch (err) {
    console.error("[Test] FALHA na conexão:", err.message);
    await client.close().catch(() => {});
    process.exit(1);
  }

  console.log("[Test] Abrindo sessão...");
  let session;
  try {
    const sessionPromise = client.openSession({ initialCatalog: CATALOG });
    const sessionTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout ao abrir sessão (30s)")), TIMEOUT_MS)
    );
    session = await Promise.race([sessionPromise, sessionTimeout]);
    console.log("[Test] Sessão aberta!");
  } catch (err) {
    console.error("[Test] FALHA ao abrir sessão:", err.message);
    await client.close().catch(() => {});
    process.exit(1);
  }

  console.log("[Test] Executando SELECT 1...");
  try {
    const op = await session.executeStatement("SELECT 1 AS ok", { runAsync: false });
    const rows = await op.fetchAll();
    await op.close().catch(() => {});
    console.log("[Test] SELECT 1 retornou:", rows);
  } catch (err) {
    console.error("[Test] FALHA ao executar query:", err.message);
  } finally {
    await session.close().catch(() => {});
    await client.close().catch(() => {});
  }

  console.log("[Test] Teste concluído com sucesso!");
}

testConnection().catch(err => {
  console.error("[Test] ERRO não capturado:", err);
  process.exit(1);
});
