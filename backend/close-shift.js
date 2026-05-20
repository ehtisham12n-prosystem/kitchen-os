const mysql = require("mysql2/promise");
async function run() {
  const c = await mysql.createConnection({ host: "localhost", user: "root", password: "admin123", database: "kitchenos" });
  const [result] = await c.query("UPDATE `shifts` SET `status` = 'closed', `closed_at` = NOW() WHERE `id` = 1");
  console.log('Update Result:', result);
  c.end();
}
run();
