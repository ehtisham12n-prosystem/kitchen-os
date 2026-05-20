const mysql = require('mysql2/promise');

async function resetDB() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || 'rootadmin1'
    });

    try {
        await connection.execute('DROP DATABASE IF EXISTS kitchenos');
        await connection.execute('CREATE DATABASE kitchenos');
        console.log('Database kitchenos has been reset.');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await connection.end();
    }
}

resetDB();
