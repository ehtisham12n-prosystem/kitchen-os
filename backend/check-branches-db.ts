import { DataSource } from 'typeorm';

async function check() {
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
    const table = await queryRunner.getTable('branches');
    console.log('Indices:', JSON.stringify(table?.indices, null, 2));
    console.log('Foreign Keys:', JSON.stringify(table?.foreignKeys, null, 2));
    await dataSource.destroy();
}

check().catch(err => console.error(err));
