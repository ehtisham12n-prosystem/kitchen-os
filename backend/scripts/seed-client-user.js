const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function seedUser() {
    const connection = await mysql.createConnection({
        host: 'localhost', user: 'root', password: 'rootadmin1', database: 'kitchenos'
    });

    try {
        const clientId = 1;
        const passwordHash = await bcrypt.hash('admin', 10);

        // 1. Ensure Role exists
        const [roles] = await connection.execute('SELECT id FROM roles WHERE id = 1');
        if (roles.length > 0) {
            await connection.execute(`
                UPDATE roles SET client_id = ${clientId}, role_name = 'Owner', permissions = '["all"]', is_system_role = 1
                WHERE id = 1
            `);
        } else {
            await connection.execute(`
                INSERT INTO roles (id, client_id, role_name, permissions, is_system_role) 
                VALUES (1, ${clientId}, 'Owner', '["all"]', 1)
            `);
        }

        // 2. Ensure User exists
        const [users] = await connection.execute('SELECT id FROM users WHERE id = 1');
        if (users.length > 0) {
            await connection.execute(`
                UPDATE users SET client_id = ${clientId}, user_name = 'admin', user_password_hash = '${passwordHash}', role_id = 1, is_active = 1
                WHERE id = 1
            `);
        } else {
            await connection.execute(`
                INSERT INTO users (id, client_id, user_name, user_password_hash, role_id, is_active, employee_id)
                VALUES (1, ${clientId}, 'admin', '${passwordHash}', 1, 1, 'EMP-001')
            `);
        }

        console.log('Client user "admin" with password "admin" (re)synchronized for Client ID 1.');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await connection.end();
    }
}

seedUser();
