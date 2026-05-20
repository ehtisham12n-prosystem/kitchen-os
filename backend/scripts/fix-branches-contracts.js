const mysql = require('mysql2/promise');

async function fixBranches() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || 'rootadmin1',
        database: process.env.DB_DATABASE || 'kitchenos'
    });

    try {
        const clientId = 'CL-41471';
        console.log(`--- Checking branches for client ${clientId} ---`);
        const [branches] = await connection.execute('SELECT * FROM branches WHERE client_id = ?', [clientId]);

        let branchId;
        if (branches.length === 0) {
            console.log('No branches found. Creating "Main Branch"...');
            await connection.execute('INSERT INTO branches (client_id, branch_name, branch_code, status, is_active) VALUES (?, "Main Branch", "MAIN-01", "active", 1)', [clientId]);
            const [newBranches] = await connection.execute('SELECT last_insert_id() as id');
            branchId = newBranches[0].id;
            console.log('✅ Created branch:', branchId);
        } else {
            branchId = branches[0].id;
            console.log('Branch already exists:', branchId);
        }

        // Now find otcadmin userId
        const [users] = await connection.execute('SELECT id FROM users WHERE user_name = "otcadmin"');
        const userId = users[0].id;

        // Ensure contract exists
        const [contracts] = await connection.execute('SELECT * FROM user_branch_roles WHERE user_id = ? AND branch_id = ?', [userId, branchId]);
        if (contracts.length === 0) {
            await connection.execute('INSERT INTO user_branch_roles (user_id, branch_id, role_id, is_primary) VALUES (?, ?, 1, 1)', [userId, branchId]);
            console.log('✅ Created UserBranchRole contract.');
        }

        console.log('Fix complete.');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await connection.end();
    }
}

fixBranches();
