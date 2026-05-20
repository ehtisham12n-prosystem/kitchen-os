const mysql = require('mysql2/promise');

async function checkIndexes() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || 'rootadmin1',
        database: 'kitchenos'
    });

    console.log('Checking Indexes on branches...');

    try {
        const [rows] = await connection.execute('SHOW INDEX FROM branches');
        console.table(rows);
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await connection.end();
    }
}

checkIndexes();
