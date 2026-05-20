const mysql = require('mysql2/promise');

async function fixCustoms() {
    const connection = await mysql.createConnection({
        host: 'localhost', user: 'root', password: 'rootadmin1', database: 'kitchenos'
    });

    try {
        await connection.execute('ALTER TABLE product_customizations CHANGE COLUMN customization_key customization_type VARCHAR(100)');
        await connection.execute('ALTER TABLE product_customizations CHANGE COLUMN price_impact customization_price_delta DECIMAL(10,2) DEFAULT 0');
        await connection.execute('ALTER TABLE product_customizations ADD COLUMN customization_is_required BOOLEAN DEFAULT FALSE');
    } catch (e) {
        console.log(e.message);
    }
    await connection.end();
}
fixCustoms();
