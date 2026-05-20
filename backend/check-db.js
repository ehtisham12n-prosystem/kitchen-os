const mysql = require("mysql2/promise");
async function run() {
  const c = await mysql.createConnection({ host: "localhost", user: "root", password: "admin123", database: "kitchenos" });
  const [rows] = await c.query("SHOW TABLES LIKE '%till%'");
  console.log('Tables:', rows);
  const [cols] = await c.query("SHOW COLUMNS FROM authorized_tills").catch(e => [e.message]);
  console.log('Cols:', cols);
  c.end();
}
run();
