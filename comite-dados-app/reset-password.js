import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

async function main() {
  const email = 'patyb7@hotmail.com';
  const password = 'Folp%1950';
  const saltRounds = 12;

  console.log(`Hashing password for ${email}...`);
  const hash = await bcrypt.hash(password, saltRounds);

  const c = await mysql.createConnection('mysql://root@127.0.0.1:3306/comite_dados');
  console.log('Updating passwordHash in database...');
  await c.query('UPDATE users SET passwordHash = ? WHERE email = ?', [hash, email]);
  
  // Also ensure the loginMethod is 'local'
  await c.query('UPDATE users SET loginMethod = "local" WHERE email = ?', [email]);
  
  console.log('Password reset successfully.');
  await c.end();
}

main().catch(console.error);
