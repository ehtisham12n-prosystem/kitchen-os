const mysql = require('mysql2/promise');

async function createCatalogTables() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || 'rootadmin1',
        database: 'kitchenos'
    });

    try {
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS menu_types (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                client_id INT NOT NULL,
                is_active BOOLEAN DEFAULT TRUE
            )
        `);

        await connection.execute(`
            CREATE TABLE IF NOT EXISTS categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                category_name VARCHAR(100) NOT NULL,
                client_id INT NOT NULL,
                is_active BOOLEAN DEFAULT TRUE
            )
        `);

        await connection.execute(`
            CREATE TABLE IF NOT EXISTS products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                product_name VARCHAR(150) NOT NULL,
                product_sku VARCHAR(50),
                client_id INT NOT NULL,
                category_id INT,
                product_base_price DECIMAL(10,2) DEFAULT 0,
                is_active BOOLEAN DEFAULT TRUE
            )
        `);

        await connection.execute(`
            CREATE TABLE IF NOT EXISTS product_customizations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                product_id INT NOT NULL,
                customization_type VARCHAR(50),
                customization_value VARCHAR(100),
                price_impact DECIMAL(10,2) DEFAULT 0
            )
        `);

        await connection.execute(`
            CREATE TABLE IF NOT EXISTS branch_product_mapping (
                id INT AUTO_INCREMENT PRIMARY KEY,
                branch_id INT NOT NULL,
                product_id INT NOT NULL,
                is_enabled BOOLEAN DEFAULT TRUE,
                price_override DECIMAL(10,2)
            )
        `);

        await connection.execute(`
            CREATE TABLE IF NOT EXISTS product_branch_prices (
                id INT AUTO_INCREMENT PRIMARY KEY,
                branch_id INT NOT NULL,
                product_id INT NOT NULL,
                menu_type_id INT NOT NULL,
                customization_id INT NULL,
                price DECIMAL(10,2) NOT NULL
            )
        `);

        console.log('Catalog tables created.');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await connection.end();
    }
}

createCatalogTables();
