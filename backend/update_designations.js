const mysql = require('mysql2/promise');

async function updateSchema() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'rootadmin1',
        database: 'kitchenos'
    });

    try {
        console.log('Adding branch_availability to designations table...');
        await connection.execute('ALTER TABLE designations ADD COLUMN branch_availability JSON NULL');
        console.log('Successfully added branch_availability column to designations.');
    } catch (err) {
        if (err.code === 'ER_PUP_COLUMN_EXISTS') {
            console.log('Column already exists.');
        } else {
            console.error('Error updating schema:', err);
        }
    } finally {
        await connection.end();
    }
}

updateSchema();
