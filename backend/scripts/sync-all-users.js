const mysql = require('mysql2/promise');

async function syncAllUsers() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'rootadmin1'
    });

    try {
        const [dbs] = await connection.execute('SHOW DATABASES');
        for (const db of dbs) {
            const dbName = db.Database;
            if (dbName === 'information_schema' || dbName === 'performance_schema' || dbName === 'mysql' || dbName === 'sys') continue;

            try {
                const [tables] = await connection.execute(`SHOW TABLES FROM \`${dbName}\` LIKE 'users'`);
                if (tables.length > 0) {
                    console.log(`Checking \`${dbName}\`.users...`);
                    const [cols] = await connection.execute(`DESCRIBE \`${dbName}\`.users`);
                    if (!cols.some(c => c.Field === 'group_id')) {
                        console.log(`Adding group_id to \`${dbName}\`.users...`);
                        await connection.execute(`ALTER TABLE \`${dbName}\`.users ADD COLUMN group_id CHAR(36) NULL`);
                        console.log('✅ Added.');
                    } else {
                        console.log('ℹ️ Already exists.');
                    }
                }
            } catch (e) {
                console.log(`Failed to check/update \`${dbName}\`: ${e.message}`);
            }
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await connection.end();
    }
}

syncAllUsers();
