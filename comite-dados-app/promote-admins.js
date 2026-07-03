import mysql from 'mysql2/promise';
async function main() {
  const c = await mysql.createConnection('mysql://root@127.0.0.1:3306/comite_dados');
  await c.query("UPDATE users SET role = 'admin' WHERE email IN ('patyb7@hotmail.com', 'pvbpwbrito@gmail.com')");
  console.log('Users promoted to admin.');
  await c.end();
}
main();
