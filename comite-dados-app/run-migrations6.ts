import { getDb } from "./server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Adding project_type to ai_projects table...");
  const db = await getDb();
  await db.execute(sql`
    ALTER TABLE "ai_projects" ADD COLUMN IF NOT EXISTS "project_type" varchar(64) DEFAULT 'IA' NOT NULL;
  `);
  console.log("Migration applied successfully.");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
