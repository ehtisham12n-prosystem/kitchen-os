const mysql = require('mysql2/promise');

async function run() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'rootadmin1',
        database: 'kitchenos'
    });

    try {
        console.log("Starting schema sync for platform and auth...");

        // 1. Drop old system_users if it exists (force recreation to align with UUIDs)
        await connection.query('DROP TABLE IF EXISTS system_users');

        // 2. Create system_roles
        await connection.query(`
            CREATE TABLE IF NOT EXISTS system_roles (
                id CHAR(36) PRIMARY KEY,
                role_name VARCHAR(100) UNIQUE NOT NULL,
                permissions JSON NULL,
                created_by VARCHAR(100) NULL,
                created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
                updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
            )
        `);
        console.log("system_roles table created/verified.");

        // 3. Create system_groups
        await connection.query(`
            CREATE TABLE IF NOT EXISTS system_groups (
                id CHAR(36) PRIMARY KEY,
                group_name VARCHAR(100) UNIQUE NOT NULL,
                description TEXT NULL,
                permissions JSON NULL,
                is_active BOOLEAN DEFAULT TRUE,
                is_system_default BOOLEAN DEFAULT FALSE,
                scope ENUM('nexus', 'client', 'branch') DEFAULT 'nexus',
                is_template BOOLEAN DEFAULT FALSE,
                created_by VARCHAR(100) NULL,
                created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
                updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
            )
        `);
        console.log("system_groups table created/verified.");

        // 4. Create system_users
        await connection.query(`
            CREATE TABLE IF NOT EXISTS system_users (
                id CHAR(36) PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                username VARCHAR(100) UNIQUE NOT NULL,
                sys_email VARCHAR(255) UNIQUE NOT NULL,
                phone VARCHAR(20) NULL,
                sys_password_hash VARCHAR(255) NOT NULL,
                role_id CHAR(36) NOT NULL,
                group_id CHAR(36) NULL,
                status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
                last_login DATETIME NULL,
                created_by VARCHAR(100) NULL,
                created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
                updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
            )
        `);
        console.log("system_users table created.");

        // 5. Create customers table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS customers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                client_id INT NOT NULL,
                name VARCHAR(150) NOT NULL,
                email VARCHAR(150) NULL,
                phone_number VARCHAR(20) NULL,
                password_hash VARCHAR(255) NULL,
                status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
                wallet_balance DECIMAL(10, 2) DEFAULT 0,
                loyalty_points INT DEFAULT 0,
                created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
                updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                UNIQUE KEY uk_client_phone (client_id, phone_number)
            )
        `);
        console.log("customers table created/verified.");

        // 6. Create auth_audits table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS auth_audits (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(100) NOT NULL,
                user_type ENUM('system', 'client', 'customer') NOT NULL,
                attempt_status ENUM('success', 'failure') NOT NULL,
                ip_address VARCHAR(45) NULL,
                user_agent TEXT NULL,
                created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6)
            )
        `);
        console.log("auth_audits table created/verified.");

        console.log("Schema sync complete.");
    } catch (err) {
        console.error("Schema sync error:", err);
    } finally {
        await connection.end();
    }
}

run();
