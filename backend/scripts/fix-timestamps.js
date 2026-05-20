const mysql = require('mysql2/promise');

async function fixAll() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'rootadmin1',
        database: 'kitchenos'
    });

    const tables = ['menu_types', 'categories', 'products', 'product_customizations', 'branch_product_mapping', 'product_branch_prices'];

    for (const table of tables) {
        try {
            await connection.execute(`ALTER TABLE ${table} ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
            await connection.execute(`ALTER TABLE ${table} ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
            console.log(`Added timestamps to ${table}`);
        } catch (e) { }
    }

    try {
        await connection.execute('ALTER TABLE product_customizations ADD COLUMN customization_key VARCHAR(50)');
        await connection.execute('ALTER TABLE products ADD COLUMN product_image_url VARCHAR(255)');
    } catch (e) { }

    await connection.end();
}

fixAll();
