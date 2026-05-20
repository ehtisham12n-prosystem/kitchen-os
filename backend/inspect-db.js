const mysql = require('mysql2/promise');

async function run() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'rootadmin1',
        database: 'kitchenos'
    });

    try {
        const [rows] = await connection.query('DESCRIBE system_users');
        console.log('system_users structure:', rows);

        const [rows2] = await connection.query('DESCRIBE system_roles');
        console.log('system_roles structure:', rows2);

        const [rows3] = await connection.query('DESCRIBE system_groups');
        console.log('system_groups structure:', rows3);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await connection.end();
    }
}

run();
