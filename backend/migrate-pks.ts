import * as mysql from 'mysql2/promise';

async function migrate() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT as string, 10) || 3306,
            user: process.env.DB_USERNAME || 'root',
            password: process.env.DB_PASSWORD || 'rootadmin1',
            database: process.env.DB_DATABASE || 'kitchenos',
        });

        console.log("Connected to database kitchenos");

        // Find all primary keys in the database
        const [rows] = await connection.execute(`
            SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = 'kitchenos' 
            AND COLUMN_KEY = 'PRI'
        `);

        let count = 0;
        for (const row of rows as any[]) {
            const tableName = row.TABLE_NAME;
            const columnName = row.COLUMN_NAME;
            const columnType = row.COLUMN_TYPE;

            if (columnName.endsWith('_id')) {
                console.log(`Renaming PK ${columnName} to id in table ${tableName}...`);
                const alterQuery = `ALTER TABLE \`${tableName}\` RENAME COLUMN \`${columnName}\` TO \`id\``;
                try {
                    await connection.execute(alterQuery);
                    console.log(`Success: ${tableName}`);
                    count++;
                } catch (err: any) {
                    console.error(`Failed to alter table ${tableName}:`, err.message);
                }
            }
        }

        console.log(`Migration completed. Renamed ${count} columns.`);
        await connection.end();
    } catch (e: any) {
        if (e.code === 'ECONNREFUSED' || e.code === 'ER_BAD_DB_ERROR') {
            console.log("Database not running or doesn't exist. Skipping DB alteration.");
        } else {
            console.error(e);
        }
    }
}

migrate();
