import 'dotenv/config';
import { Client } from 'pg';

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log("Connected to DB");
    
    // Check if column exists
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='llm_agents' and column_name='asset_type';
    `);

    if (res.rowCount === 0) {
      await client.query(`ALTER TABLE llm_agents ADD COLUMN asset_type VARCHAR(64) NOT NULL DEFAULT 'agent';`);
      console.log("Column asset_type added successfully.");
    } else {
      console.log("Column asset_type already exists.");
    }
  } catch (err) {
    console.error("Error modifying table:", err);
  } finally {
    await client.end();
  }
}

run();
