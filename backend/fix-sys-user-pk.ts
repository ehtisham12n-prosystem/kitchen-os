import { DataSource } from 'typeorm';

async function fix() {
    const dataSource = new DataSource({
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        username: 'root',
        password: 'rootadmin1',
        database: 'kitchenos',
    });

    await dataSource.initialize();
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.query('ALTER TABLE system_users RENAME COLUMN sys_userid TO id');
    console.log('Renamed sys_userid to id in system_users table');
    await dataSource.destroy();
}

fix().catch(err => console.error(err));
