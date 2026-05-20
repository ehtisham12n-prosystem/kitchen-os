const mysql = require('mysql2/promise');

async function manualSeed() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'rootadmin1',
        database: 'kitchenos'
    });

    try {
        console.log('--- Manual Seeding ---');
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

        // 1. Recreate tables if they are messy (optional, but let's stick to seeding)

        // 2. Seed Nexus Client
        console.log('Seeding Nexus Client...');
        await connection.execute(`
            INSERT IGNORE INTO clients (id, client_name, client_domain_slug, client_status, short_name)
            VALUES ('NX-10101', 'Nexus Admin', 'nexus', 'active', 'NX')
        `);

        // 3. Seed Departments
        console.log('Seeding Departments...');
        const departments = [
            ['ENGINE-D', 'Engineering', 'NX-10101'],
            ['CUSTOM-D', 'Customer Success', 'NX-10101'],
            ['FINANCE-D', 'Finance', 'NX-10101'],
            ['ANALYT-D', 'Analytics', 'NX-10101']
        ];
        for (const [code, name, cid] of departments) {
            await connection.execute(`
                INSERT IGNORE INTO departments (code, name, client_id, is_active)
                VALUES (?, ?, ?, 1)
            `, [code, name, cid]);
        }

        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
        console.log('✅ Manual Seed done.');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await connection.end();
    }
}

manualSeed();
