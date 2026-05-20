import { DataSource } from 'typeorm';
const ds = new DataSource({ type: 'mysql', host: 'localhost', port: 3306, username: 'root', password: 'rootadmin1', database: 'kitchenos' });
ds.initialize()
    .then(() => ds.query('SHOW TABLES'))
    .then(console.log)
    .finally(() => ds.destroy());
