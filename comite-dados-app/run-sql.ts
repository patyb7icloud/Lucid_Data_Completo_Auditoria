import { getDb } from "./server/db";
import { sql } from "drizzle-orm";

async function run() {
  console.log("Fixing intake_requests column cast...");
  try {
    const db = await getDb();
    
    try {
      await db!.execute(sql`ALTER TABLE intake_requests ALTER COLUMN "desiredDeadline" TYPE date USING "desiredDeadline"::date;`);
      console.log("Cast desiredDeadline to date successful.");
    } catch (e: any) { 
      console.log("Error casting desiredDeadline:", e.message); 
    }

    console.log("Done!");
  } catch (err) {
    console.error("Error during execution:", err);
  }
  process.exit(0);
}
run();
