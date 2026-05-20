const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function fixUser() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || 'rootadmin1',
        database: process.env.DB_DATABASE || 'kitchenos'
    });

    try {
        console.log('--- Checking for otcadmin ---');
        const [users] = await connection.execute('SELECT * FROM users WHERE user_name = "otcadmin"');

        if (users.length === 0) {
            console.log('User otcadmin NOT found.');
            return;
        }

        const user = users[0];
        console.log('Found user:', { id: user.id, username: user.user_name, client_id: user.client_id });

        // Ensure password is correct (re-hash to be sure)
        const passwordHash = await bcrypt.hash('1234', 10);
        await connection.execute('UPDATE users SET user_password_hash = ?, is_active = 1, status = "active" WHERE id = ?', [passwordHash, user.id]);
        console.log('✅ Updated password and status.');

        // Check for primary branch
        const [branches] = await connection.execute('SELECT * FROM branches WHERE client_id = ?', [user.client_id]);
        if (branches.length === 0) {
            console.log('No branches found for client:', user.client_id);
            return;
        }

        const branch = branches[0];
        console.log('Using branch:', { id: branch.id, name: branch.branch_name });

        // Ensure UserBranchRole contract exists
        const [contracts] = await connection.execute('SELECT * FROM user_branch_roles WHERE user_id = ? AND branch_id = ?', [user.id, branch.id]);
        if (contracts.length === 0) {
            console.log('Contract missing. Creating UserBranchRole...');
            await connection.execute('INSERT INTO user_branch_roles (user_id, branch_id, role_id, is_primary) VALUES (?, ?, 1, 1)', [user.id, branch.id]);
            console.log('✅ Created UserBranchRole contract.');
        } else {
            console.log('Contract already exists.');
        }

        console.log('OTCADMIN should now be able to login.');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await connection.end();
    }
}

fixUser();
