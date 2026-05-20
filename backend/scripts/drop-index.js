const mysql = require('mysql2/promise');

async function dropIndex() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || 'rootadmin1',
        database: 'kitchenos'
    });

    console.log('Trying to manually drop problematic index...');

    try {
        await connection.execute('DROP INDEX IDX_573a2100588a8dc9f70bb16ea8 ON branches');
        console.log('Index dropped successfully.');
    } catch (err) {
        console.error('FAILED to drop index:', err.message);
    } finally {
        await connection.end();
    }
}

dropIndex();
