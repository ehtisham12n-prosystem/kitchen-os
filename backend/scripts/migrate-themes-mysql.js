/**
 * Migration: Add slug, description, tokens columns to themes table.
 * Drops all old flat color columns and replaces with JSON tokens.
 * Database: MySQL
 * Legacy dev-only helper. Not part of the supported KitchenOS release path.
 * Use `npm run db:migrate` and `npm run bootstrap:first-run` for release setup.
 */

if (process.env.ALLOW_LEGACY_DEV_HELPER !== 'true') {
    console.error('Legacy theme migration helper disabled.');
    console.error('This script is not part of the supported release runtime. Set ALLOW_LEGACY_DEV_HELPER=true only for isolated local engineering work.');
    process.exit(1);
}

const mysql = require('mysql2/promise');

async function migrate() {
    console.log('Connecting to MySQL...');
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306'),
        database: process.env.DB_DATABASE || 'kitchenos',
        user: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || 'rootadmin1',
    });

    try {
        console.log('✅ Connected to MySQL');
        await connection.beginTransaction();

        // 1. Create table
        console.log('Creating themes table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS themes (
                id VARCHAR(36) PRIMARY KEY,
                theme_name VARCHAR(150) NOT NULL,
                slug VARCHAR(80) UNIQUE,
                description VARCHAR(255),
                tokens JSON NOT NULL,
                is_active BOOLEAN DEFAULT FALSE,
                is_system_default BOOLEAN DEFAULT FALSE,
                client_id INT NULL,
                created_by INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // Force empty the defaults so seed pushes full correct keys
        console.log('Clearing old system defaults...');
        await connection.query(`DELETE FROM themes WHERE is_system_default = 1`);

        await connection.commit();
        console.log('🎉 MySQL Table Created!');
        console.log('Make sure backend is running, then POST http://localhost:3000/v1/platform/themes/admin/seed');

    } catch (err) {
        await connection.rollback();
        console.error('❌ Migration failed, rolled back:', err.message);
        process.exit(1);
    } finally {
        await connection.end();
    }
}

migrate();
