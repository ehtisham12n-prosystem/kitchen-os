const mysql = require('mysql2/promise');

async function checkFKs() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || 'rootadmin1',
        database: 'information_schema'
    });

    console.log('Checking Foreign Keys in kitchenos...');

    try {
        const [rows] = await connection.execute(`
            SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
            FROM KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = 'kitchenos' AND REFERENCED_TABLE_NAME IS NOT NULL
        `);

        console.table(rows);
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await connection.end();
    }
}

checkFKs();
