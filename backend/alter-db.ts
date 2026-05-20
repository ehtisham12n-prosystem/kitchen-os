import { DataSource } from 'typeorm';
const ds = new DataSource({ type: 'mysql', host: 'localhost', port: 3306, username: 'root', password: 'rootadmin1', database: 'kitchenos' });
ds.initialize()
    .then(async () => {
        await ds.query('DELETE FROM system_users');
        await ds.query('ALTER TABLE system_users ADD COLUMN id char(36) NOT NULL PRIMARY KEY');
        console.log('Added id column to system_users');
    })
    .catch(err => console.error('Error adding id column:', err))
    .finally(() => ds.destroy());
