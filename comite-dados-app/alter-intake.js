import { db } from "./server/db.ts";

async function alterTable() {
  try {
    await db.execute(`
      ALTER TABLE intake_requests 
      ADD COLUMN "submitterName" varchar(128),
      ADD COLUMN "submitterEmail" varchar(128),
      ADD COLUMN "submitterPhone" varchar(32),
      ADD COLUMN "keyUser" varchar(128),
      ADD COLUMN "bpResponsible" varchar(128),
      ADD COLUMN "involvedAreas" text;
    `);
    console.log("Table altered successfully!");
  } catch (error) {
    console.error("Error altering table:", error);
  } finally {
    process.exit(0);
  }
}

alterTable();
