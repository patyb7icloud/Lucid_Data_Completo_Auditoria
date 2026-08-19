import { getDb } from "./server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Creating ai_project_checklists table...");
  const db = await getDb();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "ai_project_checklists" (
      "id" serial PRIMARY KEY NOT NULL,
      "project_id" integer NOT NULL,
      "gate" "ai_gate" NOT NULL,
      "item_text" text NOT NULL,
      "checked_at" timestamp DEFAULT now() NOT NULL,
      "checked_by" varchar(256)
    );
  `);
  console.log("Migration applied successfully.");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
