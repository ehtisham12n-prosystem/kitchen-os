import { createConnection } from 'typeorm';
import { typeOrmConfig } from '../config/typeorm.config';

async function checkCols() {
    const connection = await createConnection(typeOrmConfig as any);
    const queryRunner = connection.createQueryRunner();

    try {
        const columns = await queryRunner.query('SHOW COLUMNS FROM users');
        console.log('Columns in `users` table:');
        console.table(columns);
    } catch (error) {
        console.error('Check failed:', error);
    } finally {
        await queryRunner.release();
        await connection.close();
    }
}

checkCols().catch(console.error);
