const mysql = require('mysql2/promise');

async function testQuery() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'rootadmin1',
        database: 'kitchenos'
    });

    try {
        console.log('--- Testing query on kitchenos.users ---');
        const [rows] = await connection.execute('SELECT group_id FROM users LIMIT 1');
        console.log('Query successful. Rows:', rows.length);
    } catch (err) {
        console.error('Error on query:', err.message);
    } finally {
        await connection.end();
    }
}

testQuery();
