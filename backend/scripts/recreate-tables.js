const mysql = require('mysql2/promise');

async function recreateTables() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || 'rootadmin1',
        database: process.env.DB_DATABASE || 'kitchenos'
    });

    try {
        console.log('--- Recreating tables with correct schema ---');
        await connection.execute('SET FOREIGN_KEY_CHECKS=0');

        await connection.execute('DROP TABLE IF EXISTS branches');
        await connection.execute(`
            CREATE TABLE branches (
                id INT AUTO_INCREMENT PRIMARY KEY,
                client_id VARCHAR(20) NOT NULL,
                branch_code VARCHAR(50) NOT NULL,
                branch_name VARCHAR(150) NOT NULL,
                short_name VARCHAR(50),
                address TEXT,
                city VARCHAR(100),
                state VARCHAR(100),
                country VARCHAR(100),
                contact_person VARCHAR(150),
                tax_region VARCHAR(50),
                currency_code VARCHAR(10) DEFAULT 'USD',
                language VARCHAR(10) DEFAULT 'en',
                theme_id VARCHAR(50),
                modules_enabled TEXT,
                opening_time TIME,
                closing_time TIME,
                status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
                is_active TINYINT(1) DEFAULT 1,
                branch_phone VARCHAR(50),
                branch_email VARCHAR(150),
                max_users INT,
                created_by VARCHAR(50),
                updated_by VARCHAR(50),
                created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
                updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
            ) ENGINE=InnoDB;
        `);
        console.log('✅ branches recreated.');

        await connection.execute('DROP TABLE IF EXISTS users');
        await connection.execute(`
            CREATE TABLE users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                client_id VARCHAR(20),
                branch_id INT,
                role_id INT,
                department_id INT,
                designation_id INT,
                group_id CHAR(36),
                employee_id VARCHAR(50),
                user_name VARCHAR(150) NOT NULL,
                user_password_hash VARCHAR(255) NOT NULL,
                management_pin VARCHAR(10),
                pos_approval_pin VARCHAR(10),
                pos_user_pin VARCHAR(10),
                profile_picture TEXT,
                is_active TINYINT(1) DEFAULT 1,
                created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
                updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                full_name VARCHAR(150),
                first_name VARCHAR(75),
                last_name VARCHAR(75),
                email VARCHAR(150) UNIQUE,
                user_type ENUM('PLATFORM_ADMIN', 'CLIENT_ADMIN', 'BRANCH_STAFF') DEFAULT 'BRANCH_STAFF',
                status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
                is_locked TINYINT(1) DEFAULT 0,
                wrong_attempts_limit INT DEFAULT 5,
                last_login TIMESTAMP NULL,
                phone VARCHAR(20),
                cnic_number VARCHAR(20),
                address TEXT
            ) ENGINE=InnoDB;
        `);
        console.log('✅ users recreated.');

        await connection.execute('DROP TABLE IF EXISTS user_branch_roles');
        await connection.execute(`
            CREATE TABLE user_branch_roles (
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
        console.log('✅ user_branch_roles recreated.');

        await connection.execute('SET FOREIGN_KEY_CHECKS=1');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await connection.end();
    }
}

recreateTables();
