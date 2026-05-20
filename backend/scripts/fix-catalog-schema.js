const mysql = require('mysql2/promise');

async function fixCatalogColumns() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'rootadmin1',
        database: 'kitchenos'
    });

    try {
        const alterations = [
            { table: 'menu_types', col: 'description VARCHAR(255) NULL' },
            { table: 'products', col: 'product_sku VARCHAR(50) NULL' },
            { table: 'products', col: 'category_id INT NULL' },
            { table: 'products', col: 'cuisine_type_id INT NULL' },
            { table: 'products', col: 'is_enabled BOOLEAN DEFAULT TRUE' }
        ];

        for (const alt of alterations) {
            const colName = alt.col.split(' ')[0];
            await connection.execute(`ALTER TABLE ${alt.table} ADD COLUMN ${alt.col}`)
                .then(() => console.log(`Added ${colName} to ${alt.table}`))
                .catch(e => {
                    if (e.message.includes('Duplicate column name')) console.log(`${colName} exists in ${alt.table}`);
                    else console.error(`Error in ${alt.table}.${colName}:`, e.message);
                });
        }
    } finally {
        await connection.end();
    }
}

fixCatalogColumns();
