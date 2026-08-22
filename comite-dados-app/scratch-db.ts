import { getDb } from "./server/db";
import { sql } from "drizzle-orm";

async function run() {
  const db = await getDb();
  const res = await db!.execute(sql`SELECT * FROM system_settings`);
  console.log("System Settings:", res);
  process.exit(0);
}
run();
