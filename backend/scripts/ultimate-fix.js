const mysql = require('mysql2/promise');

async function ultimateFix() {
    const connection = await mysql.createConnection({
        host: 'localhost', user: 'root', password: 'rootadmin1', database: 'kitchenos'
    });

    const queries = [
        "ALTER TABLE categories ADD COLUMN category_description TEXT NULL",
        "ALTER TABLE categories ADD COLUMN image_url VARCHAR(255) NULL",
        "ALTER TABLE products ADD COLUMN description TEXT NULL",
        "ALTER TABLE products ADD COLUMN image_url VARCHAR(255) NULL",
        "ALTER TABLE product_customizations ADD COLUMN is_active BOOLEAN DEFAULT TRUE",
        "ALTER TABLE product_customizations ADD COLUMN customization_key VARCHAR(100) NULL"
    ];

    for (const q of queries) {
        try { await connection.execute(q); console.log('Executed:', q); } catch (e) { console.log('Skipped (exists or error):', q); }
    }
    await connection.end();
}
ultimateFix();
