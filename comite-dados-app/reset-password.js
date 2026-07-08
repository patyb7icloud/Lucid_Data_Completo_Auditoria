import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Client } = pg;

/**
 * Redefine a senha de um usuário local.
 * Uso: RESET_EMAIL="usuario@dominio.com" RESET_PASSWORD="NovaSenhaForte" node reset-password.js
 * Requer: DATABASE_URL no formato postgresql://user:pass@host:5432/dbname
 *
 * SEGURANÇA: nunca coloque e-mails ou senhas hardcoded neste arquivo.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const email = process.env.RESET_EMAIL;
  const password = process.env.RESET_PASSWORD;

  if (!email || !password) {
    console.error('Uso: RESET_EMAIL="usuario@dominio.com" RESET_PASSWORD="NovaSenhaForte" node reset-password.js');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("A senha deve ter no mínimo 8 caracteres.");
    process.exit(1);
  }

  const saltRounds = 12;

  console.log(`Hashing password for ${email}...`);
  const hash = await bcrypt.hash(password, saltRounds);

  const client = new Client({ connectionString: url });
  await client.connect();

  console.log('Updating passwordHash in database...');
  const result = await client.query(
    'UPDATE users SET "passwordHash" = $1, "loginMethod" = \'local\', "updatedAt" = NOW() WHERE email = $2',
    [hash, email]
  );

  if (result.rowCount === 0) {
    console.error(`Nenhum usuário encontrado com o e-mail ${email}.`);
  } else {
    console.log('Password reset successfully.');
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
