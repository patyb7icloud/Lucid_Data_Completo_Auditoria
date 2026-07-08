import pg from 'pg';
const { Client } = pg;

/**
 * Promove usuários a admin.
 * Uso: ADMIN_EMAILS="email1@dominio.com,email2@dominio.com" node promote-admins.js
 * Requer: DATABASE_URL no formato postgresql://user:pass@host:5432/dbname
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const emails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  if (emails.length === 0) {
    console.error("ADMIN_EMAILS is not set. Ex: ADMIN_EMAILS=\"admin@empresa.com\" node promote-admins.js");
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  const result = await client.query(
    "UPDATE users SET role = 'admin' WHERE email = ANY($1::text[])",
    [emails]
  );

  console.log(`${result.rowCount} user(s) promoted to admin.`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
