const mysql = require('mysql2/promise');

async function clearSystemUsers() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || 'rootadmin1',
        database: 'kitchenos'
    });

    try {
        await connection.execute('DELETE FROM system_users');
        await connection.execute('DELETE FROM system_roles').catch(e => console.log(e.message));
        console.log('Cleared problematic tables.');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await connection.end();
    }
}

clearSystemUsers();
