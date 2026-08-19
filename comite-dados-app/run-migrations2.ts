import { getDb } from "./server/db";
import { sql } from "drizzle-orm";

async function main() {
  const db = await getDb();
  console.log("Creating ai_projects table and enums...");
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "ai_gate" AS ENUM('G0', 'G1', 'G2', 'G3');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
    
    DO $$ BEGIN
      CREATE TYPE "ai_project_status" AS ENUM('active', 'paused', 'completed', 'cancelled');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "ai_projects" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar(256) NOT NULL,
      "description" text,
      "department" varchar(128),
      "gate" "ai_gate" DEFAULT 'G0' NOT NULL,
      "status" "ai_project_status" DEFAULT 'active' NOT NULL,
      "owner_id" integer,
      "risk_level" "risk_level" DEFAULT 'medio' NOT NULL,
      "compliance_score" integer DEFAULT 0,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );
  `);
  console.log("Table created.");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
