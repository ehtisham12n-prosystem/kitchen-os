const mysql = require('mysql2/promise');

async function clearDatabase() {
    const config = {
        host: 'localhost',
        user: 'root',
        password: 'rootadmin1',
        database: 'kitchenos',
    };

    try {
        const connection = await mysql.createConnection(config);
        console.log('Connected to MySQL.');

        // Disable foreign key checks to drop tables in any order
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');

        // Get all tables
        const [rows] = await connection.query("SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = 'kitchenos'");
        const tables = rows.map(row => row.TABLE_NAME);

        console.log(`Found ${tables.length} tables. Dropping...`);

        for (const table of tables) {
            await connection.query(`DROP TABLE IF EXISTS \`${table}\``);
            console.log(`Dropped table: ${table}`);
        }

        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('Database cleared successfully.');
        await connection.end();
    } catch (err) {
        console.error('Error clearing database:', err);
        process.exit(1);
    }
}

clearDatabase();
