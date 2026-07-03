#!/usr/bin/env node
/**
 * Executor de migrations PostgreSQL.
 * Lê todos os .sql em ./drizzle, divide por --> statement-breakpoint e executa.
 * Uso: node run-migrations.js
 */
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL is not set"); process.exit(1); }

  const client = new Client({ connectionString: url });
  await client.connect();
  console.log("[migrations] Connected to PostgreSQL.");

  const dir = path.join(__dirname, "drizzle");
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".sql")).sort();

  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), "utf8");
    const statements = content.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean);
    console.log(`[migrations] Running ${file} (${statements.length} statements)...`);
    for (const stmt of statements) {
      try {
        await client.query(stmt);
      } catch (err) {
        if (err.message.includes("already exists")) {
          console.warn(`  [skip] ${err.message.substring(0, 80)}`);
        } else {
          console.error(`  [error] ${err.message}`);
        }
      }
    }
  }

  await client.end();
  console.log("[migrations] Done.");
}

main().catch(err => { console.error(err); process.exit(1); });
