const mysql = require('mysql2/promise');

async function fix() {
    try {
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: 'rootadmin1',
            database: 'kitchenos'
        });

        console.log('Adding group_id column to users table...');
        await connection.query('ALTER TABLE users ADD COLUMN group_id CHAR(36) NULL AFTER designation_id');

        console.log('Column added successfully.');
        await connection.end();
    } catch (e) {
        console.error('Fix Error:', e.message);
    }
}
fix();
