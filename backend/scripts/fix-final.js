const mysql = require('mysql2/promise');

async function fixFinal() {
    const connection = await mysql.createConnection({
        host: 'localhost', user: 'root', password: 'rootadmin1', database: 'kitchenos'
    });

    const tables = ['cuisine_types', 'stations', 'uoms'];
    for (const table of tables) {
        try {
            await connection.execute(`ALTER TABLE ${table} ADD COLUMN is_active BOOLEAN DEFAULT TRUE`);
        } catch (e) { }
    }
    await connection.end();
}
fixFinal();
