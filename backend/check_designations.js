const mysql = require('mysql2/promise');

async function checkSchema() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'rootadmin1',
        database: 'kitchenos'
    });

    try {
        const [rows] = await connection.execute('DESCRIBE designations');
        console.log('Schema for designations:');
        console.table(rows);
    } catch (err) {
        console.error('Error describing designations:', err);
    } finally {
        await connection.end();
    }
}

checkSchema();
