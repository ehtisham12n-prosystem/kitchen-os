const mysql = require("mysql2/promise");
async function run() {
  const c = await mysql.createConnection({ host: "localhost", user: "root", password: "admin123", database: "kitchenos" });
  const [cols] = await c.query("SHOW COLUMNS FROM shifts").catch(e => [e.message]);
  console.log('Shifts Cols:', cols);
  c.end();
}
run();
