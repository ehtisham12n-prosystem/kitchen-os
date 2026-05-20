const mysql = require('mysql2/promise');

async function fixMinor() {
    const connection = await mysql.createConnection({
        host: 'localhost', user: 'root', password: 'rootadmin1', database: 'kitchenos'
    });

    const tables = ['cuisine_types', 'stations', 'uoms'];
    for (const table of tables) {
        try {
            await connection.execute(`ALTER TABLE ${table} ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
            await connection.execute(`ALTER TABLE ${table} ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
        } catch (e) { }
    }
    await connection.end();
}
fixMinor();
