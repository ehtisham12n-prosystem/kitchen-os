const mysql = require('mysql2/promise');

async function check() {
    try {
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: 'rootadmin1',
            database: 'kitchenos'
        });
        const [rows] = await connection.query('DESCRIBE users');
        console.log('Columns:', JSON.stringify(rows, null, 2));
        await connection.end();
    } catch (e) {
        console.error('DB Error:', e.message);
    }
}
check();
