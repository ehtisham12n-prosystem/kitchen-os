import { createConnection } from 'typeorm';
import { typeOrmConfig } from '../config/typeorm.config';

async function fixSchema() {
    const connection = await createConnection(typeOrmConfig as any);
    const queryRunner = connection.createQueryRunner();

    console.log('--- Database Schema Sync - UserManagement Table ---');

    try {
        const columns = [
            'ALTER TABLE `users` ADD COLUMN `first_name` varchar(75) DEFAULT NULL AFTER `full_name`',
            'ALTER TABLE `users` ADD COLUMN `last_name` varchar(75) DEFAULT NULL AFTER `first_name`',
            'ALTER TABLE `users` ADD COLUMN `profile_picture` text DEFAULT NULL AFTER `last_login`',
            'ALTER TABLE `users` ADD COLUMN `phone` varchar(20) DEFAULT NULL AFTER `profile_picture`',
            'ALTER TABLE `users` ADD COLUMN `cnic_number` varchar(20) DEFAULT NULL AFTER `phone`',
            'ALTER TABLE `users` ADD COLUMN `address` text DEFAULT NULL AFTER `cnic_number`',
            'ALTER TABLE `users` ADD COLUMN `is_active` tinyint(1) NOT NULL DEFAULT 1 AFTER `address`'
        ];

        for (const sql of columns) {
            console.log(`Executing: ${sql}`);
            try {
                await queryRunner.query(sql);
            } catch (e) {
                console.warn(`Warning: Could not add column. It might already exist.`);
            }
        }

        console.log('✅ Schema synchronization complete.');
    } catch (error) {
        console.error('❌ Schema Sync Failed:', error);
    } finally {
        await queryRunner.release();
        await connection.close();
    }
}

fixSchema().catch(console.error);
