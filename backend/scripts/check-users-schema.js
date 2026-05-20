const mysql = require('mysql2/promise');

async function checkUsersSchema() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || 'rootadmin1',
        database: process.env.DB_DATABASE || 'kitchenos'
    });

    try {
        const [rows] = await connection.execute('DESCRIBE users');
        console.log('--- users table columns ---');
        rows.forEach(row => {
            console.log(`${row.Field}: ${row.Type}`);
        });
        console.log('---------------------------');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await connection.end();
    }
}

checkUsersSchema();
