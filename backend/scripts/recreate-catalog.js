const mysql = require('mysql2/promise');

async function recreateCatalog() {
    const connection = await mysql.createConnection({
        host: 'localhost', user: 'root', password: 'rootadmin1', database: 'kitchenos'
    });

    try {
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

        const tables = [
            'menu_types', 'categories', 'products', 'product_customizations',
            'branch_product_mapping', 'product_branch_prices', 'cuisine_types', 'stations', 'uoms'
        ];

        for (const t of tables) {
            await connection.execute(`DROP TABLE IF EXISTS ${t}`);
        }

        await connection.execute(`
            CREATE TABLE menu_types (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(150) NOT NULL,
                description TEXT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                client_id INT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await connection.execute(`
            CREATE TABLE categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                category_name VARCHAR(150) NOT NULL,
                category_description TEXT NULL,
                category_sort_order INT DEFAULT 0,
                client_id INT NOT NULL,
                parent_category_id INT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await connection.execute(`
            CREATE TABLE products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                product_name VARCHAR(150) NOT NULL,
                product_description TEXT NULL,
                product_image_url VARCHAR(255) NULL,
                product_sku VARCHAR(100) NULL,
                product_base_price DECIMAL(10,2) DEFAULT 0,
                product_is_configurable BOOLEAN DEFAULT FALSE,
                is_active BOOLEAN DEFAULT TRUE,
                client_id INT NOT NULL,
                category_id INT NULL,
                cuisine_type_id INT NULL,
                menu_type_id INT NULL,
                production_station_id INT NULL,
                base_uom_id INT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await connection.execute(`
            CREATE TABLE product_customizations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                product_id INT NOT NULL,
                customization_key VARCHAR(100) NULL,
                customization_value VARCHAR(150) NOT NULL,
                price_impact DECIMAL(10,2) DEFAULT 0,
                is_active BOOLEAN DEFAULT TRUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await connection.execute(`
            CREATE TABLE branch_product_mapping (
                id INT AUTO_INCREMENT PRIMARY KEY,
                branch_id INT NOT NULL,
                product_id INT NOT NULL,
                is_enabled BOOLEAN DEFAULT TRUE,
                price_override DECIMAL(10,2) NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await connection.execute(`
            CREATE TABLE product_branch_prices (
                id INT AUTO_INCREMENT PRIMARY KEY,
                branch_id INT NOT NULL,
                product_id INT NOT NULL,
                menu_type_id INT NOT NULL,
                customization_id INT NULL,
                price DECIMAL(10,2) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await connection.execute('CREATE TABLE cuisine_types (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100), client_id INT)');
        await connection.execute('CREATE TABLE stations (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100), client_id INT)');
        await connection.execute('CREATE TABLE uoms (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(50), client_id INT)');

        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
        console.log('RECREATED all catalog tables with full schemas.');
    } finally {
        await connection.end();
    }
}
recreateCatalog();
