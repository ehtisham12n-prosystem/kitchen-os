const mysql = require('mysql2/promise');

async function fixSchema() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || 'rootadmin1',
        database: process.env.DB_DATABASE || 'kitchenos'
    });

    console.log('Connected to MySQL. Adding missing columns...');

    try {
        const columns = [
            { name: 'opening_time', type: 'TIME NULL' },
            { name: 'closing_time', type: 'TIME NULL' },
            { name: 'is_active', type: 'BOOLEAN DEFAULT TRUE' },
            { name: 'status', type: "ENUM('active', 'inactive', 'suspended') DEFAULT 'active'" },
            { name: 'branch_phone', type: 'VARCHAR(50) NULL' },
            { name: 'branch_email', type: 'VARCHAR(150) NULL' },
            { name: 'max_users', type: 'INT NULL' }
        ];

        for (const col of columns) {
            await connection.execute(`
                ALTER TABLE branches 
                ADD COLUMN ${col.name} ${col.type}
            `).then(() => {
                console.log(`Added column ${col.name}`);
            }).catch(err => {
                if (err.message.includes('Duplicate column name')) {
                    console.log(`Column ${col.name} already exists`);
                } else {
                    console.error(`Error adding ${col.name}:`, err.message);
                }
            });
        }

        console.log('Schema update completed.');
    } catch (err) {
        console.error('Error fixing schema:', err.message);
    } finally {
        await connection.end();
    }
}

fixSchema();
