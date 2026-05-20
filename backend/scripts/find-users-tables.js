const mysql = require('mysql2/promise');

async function findUsersTables() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'rootadmin1'
    });

    try {
        const [dbs] = await connection.execute('SHOW DATABASES');
        console.log('--- Databases found ---');
        for (const db of dbs) {
            const dbName = db.Database;
            try {
                const [tables] = await connection.execute(`SHOW TABLES FROM \`${dbName}\` LIKE 'users'`);
                if (tables.length > 0) {
                    console.log(`[${dbName}] has 'users' table.`);
                    const [cols] = await connection.execute(`DESCRIBE \`${dbName}\`.users`);
                    const hasGroupId = cols.some(c => c.Field === 'group_id');
                    console.log(`  - group_id exists: ${hasGroupId}`);
                }
            } catch (e) { }
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await connection.end();
    }
}

findUsersTables();
