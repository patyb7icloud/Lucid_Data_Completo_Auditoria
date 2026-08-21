import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to DB.");

    // Check if column exists first to be safe
    await client.query(`
      ALTER TABLE ml_prediction_logs ADD COLUMN IF NOT EXISTS prompt_tokens INTEGER;
      ALTER TABLE ml_prediction_logs ADD COLUMN IF NOT EXISTS completion_tokens INTEGER;
      ALTER TABLE ml_prediction_logs ADD COLUMN IF NOT EXISTS cost_usd REAL;
    `);

    console.log("Successfully added columns to ml_prediction_logs!");
  } catch (error) {
    console.error("Error updating schema:", error);
  } finally {
    await client.end();
  }
}

run();
