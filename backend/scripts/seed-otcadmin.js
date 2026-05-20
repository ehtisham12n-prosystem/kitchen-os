const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function seedOtcAdmin() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'rootadmin1',
        database: 'kitchenos'
    });

    try {
        const clientId = 'CL-41471';
        const passwordHash = await bcrypt.hash('1234', 10);

        console.log('--- Seeding otcadmin ---');
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

        // 1. Create Client
        await connection.execute('INSERT IGNORE INTO clients (id, client_name, client_domain_slug) VALUES (?, "Over The Counter", "otc")', [clientId]);

        // 2. Create Role
        const [roleResult] = await connection.execute(
            'INSERT IGNORE INTO roles (client_id, role_name, permissions, is_system_role) VALUES (?, ?, ?, ?)',
            [clientId, 'Client Admin', JSON.stringify(['all']), 1]
        );
        let roleId = roleResult.insertId;
        if (!roleId) {
            const [existingRoles] = await connection.execute('SELECT id FROM roles WHERE client_id = ? AND role_name = ?', [clientId, 'Client Admin']);
            roleId = existingRoles[0].id;
        }
        console.log('✅ Role check/create done:', roleId);

        // 3. Insert User
        const [userResult] = await connection.execute(
            'INSERT INTO users (client_id, user_name, user_password_hash, user_type, status, full_name, role_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [clientId, 'otcadmin', passwordHash, 'CLIENT_ADMIN', 'active', 'OTC Admin', roleId]
        );
        const userId = userResult.insertId;
        console.log('✅ User created:', userId);

        // 4. Insert Branch
        const [branchResult] = await connection.execute(
            'INSERT INTO branches (client_id, branch_name, branch_code, status, is_active) VALUES (?, ?, ?, ?, ?)',
            [clientId, 'Main Branch', 'MAIN-01', 'active', 1]
        );
        const branchId = branchResult.insertId;
        console.log('✅ Branch created:', branchId);

        // 5. Create Contract
        await connection.execute(
            'INSERT INTO user_branch_roles (user_id, branch_id, role_id, is_primary) VALUES (?, ?, ?, 1)',
            [userId, branchId, roleId]
        );
        console.log('✅ UserBranchRole contract created.');

        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
        console.log('Seed complete. Try logging in now!');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await connection.end();
    }
}

seedOtcAdmin();
