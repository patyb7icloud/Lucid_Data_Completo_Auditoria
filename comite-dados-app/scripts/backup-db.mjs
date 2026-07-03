#!/usr/bin/env node
/**
 * Backup do banco PostgreSQL usando pg_dump.
 * Uso: node scripts/backup-db.mjs
 * Requer: DATABASE_URL no formato postgresql://user:pass@host:5432/dbname
 */
import { execSync } from "child_process";
import { mkdirSync } from "fs";
import { join } from "path";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is not set"); process.exit(1); }

const parsed = new URL(url);
const dbName = parsed.pathname.replace(/^\//, "");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const backupDir = join(process.cwd(), "backups");
mkdirSync(backupDir, { recursive: true });
const outFile = join(backupDir, `backup-${timestamp}.sql`);

const env = {
  ...process.env,
  PGPASSWORD: parsed.password,
};

const cmd = [
  "pg_dump",
  `--host=${parsed.hostname}`,
  `--port=${parsed.port || 5432}`,
  `--username=${parsed.username}`,
  `--dbname=${dbName}`,
  "--no-password",
  "--format=plain",
  `--file=${outFile}`,
].join(" ");

console.log(`[backup] Backing up "${dbName}" to ${outFile}...`);
execSync(cmd, { env, stdio: "inherit" });
console.log("[backup] Done.");
