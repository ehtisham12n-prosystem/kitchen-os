const { DataSource } = require('typeorm');
const { typeOrmConfig } = require('./dist/config/typeorm.config');

async function debug() {
    const ds = new DataSource({
        ...typeOrmConfig,
        entities: ['./dist/**/*.entity.js'],
        synchronize: false
    });
    await ds.initialize();
    try {
        const users = await ds.query("SELECT id, full_name, user_name, user_type, client_id FROM users LIMIT 10");
        console.log("Users in DB:", users);
        const clients = await ds.query("SELECT id, client_name FROM clients LIMIT 10");
        console.log("Clients in DB:", clients);
    } finally {
        await ds.destroy();
    }
}
debug().catch(console.error);
