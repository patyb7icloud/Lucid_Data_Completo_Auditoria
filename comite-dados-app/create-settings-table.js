import mysql from 'mysql2/promise';
async function main() {
  const c = await mysql.createConnection('mysql://root@127.0.0.1:3306/comite_dados');
  await c.query('CREATE TABLE IF NOT EXISTS system_settings (id INT AUTO_INCREMENT PRIMARY KEY, `key` VARCHAR(100) NOT NULL UNIQUE, value TEXT, description TEXT, updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)');
  console.log('Table system_settings created');
  await c.end();
}
main().catch(console.error);
