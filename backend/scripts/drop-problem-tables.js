const mysql = require('mysql2/promise');

async function dropProblematicTables() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || 'rootadmin1',
        database: 'kitchenos'
    });

    try {
        await connection.execute('DROP TABLE IF EXISTS system_users');
        await connection.execute('DROP TABLE IF EXISTS system_roles');
        console.log('Dropped system_users and system_roles.');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await connection.end();
    }
}

dropProblematicTables();
