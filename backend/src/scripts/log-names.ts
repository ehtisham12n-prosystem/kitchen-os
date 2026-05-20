import { createConnection } from 'typeorm';
import { typeOrmConfig } from '../config/typeorm.config';

async function logNames() {
    const connection = await createConnection(typeOrmConfig as any);
    try {
        const rows = await connection.query('SHOW COLUMNS FROM users');
        const names = rows.map((r: any) => r.Field);
        console.log('COLUMN NAMES:', names.join(', '));
    } finally {
        await connection.close();
    }
}
logNames().catch(console.error);
