const mysql = require('mysql2/promise');

async function createMissingTables() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || 'rootadmin1',
        database: process.env.DB_DATABASE || 'kitchenos'
    });

    try {
        console.log('--- Creating missing RBAC tables ---');

        await connection.execute(`
            CREATE TABLE IF NOT EXISTS user_branch_roles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                branch_id INT NOT NULL,
                role_id INT NULL,
                is_primary TINYINT(1) DEFAULT 0,
                created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
                updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                UNIQUE KEY IDX_user_branch_roles (user_id, branch_id)
            ) ENGINE=InnoDB;
        `);
        console.log('✅ user_branch_roles created.');

        await connection.execute(`
            CREATE TABLE IF NOT EXISTS user_branch_permissions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                branch_id INT NOT NULL,
                permission_id VARCHAR(150) NOT NULL,
                created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
                updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                UNIQUE KEY IDX_user_branch_permissions (user_id, branch_id, permission_id)
            ) ENGINE=InnoDB;
        `);
        console.log('✅ user_branch_permissions created.');

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await connection.end();
    }
}

createMissingTables();
