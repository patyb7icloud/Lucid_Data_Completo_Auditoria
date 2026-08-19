import { getDb } from "./server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Applying ai_projects migrations for Go/No-go and integrations...");
  const db = await getDb();
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "go_no_go_status" AS ENUM('pending', 'go', 'no_go');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    ALTER TABLE "ai_projects" 
      ADD COLUMN IF NOT EXISTS "servicenow_ticket" varchar(128),
      ADD COLUMN IF NOT EXISTS "azure_devops_url" varchar(512),
      ADD COLUMN IF NOT EXISTS "terms_accepted" boolean DEFAULT false NOT NULL,
      ADD COLUMN IF NOT EXISTS "go_no_go_status" "go_no_go_status" DEFAULT 'pending' NOT NULL;
  `);
  console.log("Migration applied successfully.");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
