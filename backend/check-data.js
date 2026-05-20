const mysql = require("mysql2/promise");
async function run() {
  const c = await mysql.createConnection({ host: "localhost", user: "root", password: "admin123", database: "kitchenos" });
  const [shifts] = await c.query("SELECT * FROM shifts ORDER BY id DESC LIMIT 5");
  console.log('Shifts:', shifts);
  const [tills] = await c.query("SELECT * FROM authorized_tills ORDER BY id DESC LIMIT 5");
  console.log('Tills:', tills);
  c.end();
}
run();
