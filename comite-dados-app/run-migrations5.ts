import { getDb } from "./server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Adding evidence_link to ai_project_checklists table...");
  const db = await getDb();
  await db.execute(sql`
    ALTER TABLE "ai_project_checklists" ADD COLUMN IF NOT EXISTS "evidence_link" varchar(1024);
  `);
  console.log("Migration applied successfully.");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
