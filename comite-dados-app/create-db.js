#!/usr/bin/env node
/**
 * Bootstrap script — cria o banco de dados PostgreSQL se não existir.
 * Uso: node create-db.js
 * Requer: DATABASE_URL no formato postgresql://user:pass@host:5432/dbname
 */
const { Client } = require("pg");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const parsed = new URL(url);
  const dbName = parsed.pathname.replace(/^\//, "");
  parsed.pathname = "/postgres";
  const adminUrl = parsed.toString();

  const client = new Client({ connectionString: adminUrl });
  await client.connect();

  const { rows } = await client.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`,
    [dbName]
  );

  if (rows.length === 0) {
    await client.query(`CREATE DATABASE "${dbName}"`);
    console.log(`[create-db] Database "${dbName}" created.`);
  } else {
    console.log(`[create-db] Database "${dbName}" already exists.`);
  }

  await client.end();
}

main().catch((err) => {
  console.error("[create-db] Error:", err.message);
  process.exit(1);
});
