const mysql = require('mysql2/promise');
const path = require('path');
require('ts-node').register({ transpileOnly: true });
const { getDatabaseConfig } = require('./src/config/database.config');

async function main() {
    const config = getDatabaseConfig();
    const connection = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password,
        database: config.database,
    });

    try {
        console.log('--- TABLES ---');
        const [tables] = await connection.query('SHOW TABLES');
        console.log(JSON.stringify(tables, null, 2));

        const tablesToCheck = ['products', 'price_profiles', 'product_branch_prices', 'branch_product_mapping'];
        for (const table of tablesToCheck) {
            console.log(`\n--- COLUMNS FOR ${table} ---`);
            const [columns] = await connection.query(`DESCRIBE ${table}`);
            console.log(JSON.stringify(columns, null, 2));
        }

    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

main();
