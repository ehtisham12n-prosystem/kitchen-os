const mysql = require('mysql2/promise');

async function syncUsersSchema() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || 'rootadmin1',
        database: process.env.DB_DATABASE || 'kitchenos'
    });

    console.log('Connected to MySQL. Syncing users table schema...');

    const columnsToAdd = [
        { name: 'group_id', type: 'CHAR(36) NULL' }
    ];

    try {
        for (const col of columnsToAdd) {
            try {
                await connection.execute(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
                console.log(`✅ Added column: ${col.name}`);
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    console.log(`ℹ️ Column ${col.name} already exists.`);
                } else {
                    console.error(`❌ Error adding ${col.name}:`, err.message);
                }
            }
        }

        // Also ensure user_password_hash exists (UserManagement.entity.ts might have mapped it differently or name was changed)
        // Previous error showed user_password_hash in the query

        console.log('Schema sync completed.');
    } catch (err) {
        console.error('Fatal error:', err.message);
    } finally {
        await connection.end();
    }
}

syncUsersSchema();
