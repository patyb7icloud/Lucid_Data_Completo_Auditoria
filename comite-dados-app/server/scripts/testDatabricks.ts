import { DatabricksAdapter } from "../adapters/DatabricksAdapter.js";
import { resolveDatabricksToken } from "../akvResolver.js";

async function main() {
  try {
    const token = await resolveDatabricksToken({ authMode: "entra_id" });
    if (!token) {
      console.log("Token is null!");
      return;
    }
    const adapter = new DatabricksAdapter({
      host: "adb-3226187933874518.18.azuredatabricks.net",
      httpPath: "/sql/1.0/warehouses/084599d1aadfad17",
      token: token,
      catalog: "nexa_dho_dev"
    }, "Patricia");
    const ok = await adapter.testConnection();
    console.log("testConnection ok:", ok);
  } catch (e) {
    console.error(e);
  }
}

main();
