import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5433/lucid_data_governance",
});
const db = drizzle(pool);

async function main() {
  console.log("Running alter table...");
  try {
    await pool.query('ALTER TABLE data_assets ADD COLUMN IF NOT EXISTS "piiBypassGroups" JSONB;');
    console.log("Success!");
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await pool.end();
  }
}
main();
