const mysql = require('mysql2/promise');

async function dropAllConstraints() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || 'rootadmin1'
    });

    console.log('Dropping ALL foreign keys in kitchenos to allow clean synchronization...');

    try {
        const [fks] = await connection.execute(`
            SELECT TABLE_NAME, CONSTRAINT_NAME
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = 'kitchenos' AND REFERENCED_TABLE_NAME IS NOT NULL
        `);

        for (const fk of fks) {
            console.log(`Dropping FK ${fk.CONSTRAINT_NAME} from ${fk.TABLE_NAME}...`);
            await connection.execute(`ALTER TABLE kitchenos.${fk.TABLE_NAME} DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`).catch(e => console.log(`  Failed: ${e.message}`));
        }

        console.log('All constraints dropped.');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await connection.end();
    }
}

dropAllConstraints();
