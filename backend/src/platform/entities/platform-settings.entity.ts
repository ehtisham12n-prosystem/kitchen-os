import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('platform_settings')
export class PlatformSettings {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'system_name', length: 100, default: 'KitchenOS' })
    system_name: string;

    @Column({ name: 'default_currency', length: 10, default: 'USD' })
    currency: string;

    @Column({ name: 'timezone', length: 50, default: 'UTC' })
    timezone: string;

    @Column({ name: 'contact_email', type: 'varchar', length: 255, nullable: true })
    contact_email: string;

    @Column({ name: 'contact_phone', type: 'varchar', length: 255, nullable: true })
    contact_phone: string;

    @Column({ type: 'text', nullable: true })
    address: string;

    @Column({ name: 'renewal_contact_name', type: 'varchar', length: 255, nullable: true })
    renewal_contact_name: string;

    @Column({ name: 'renewal_contact_email', type: 'varchar', length: 255, nullable: true })
    renewal_contact_email: string;

    @Column({ name: 'renewal_contact_phone', type: 'varchar', length: 255, nullable: true })
    renewal_contact_phone: string;

    @Column({ name: 'maintenance_mode', default: false })
    maintenance_mode: boolean;

    @Column({ name: 'date_format', length: 20, default: 'YYYY-MM-DD' })
    date_format: string;

    @Column({ name: 'email_gateway_key', type: 'varchar', length: 255, nullable: true })
    email_gateway_key: string;

    @Column({ name: 'sms_gateway_key', type: 'varchar', length: 255, nullable: true })
    sms_gateway_key: string;

    @Column({ name: 'google_maps_api_key', type: 'varchar', length: 255, nullable: true })
    google_maps_api_key: string;

    @Column({ name: 'global_grace_period_days', type: 'int', default: 7 })
    global_grace_period_days: number;

    @Column({ name: 'auto_lock_behavior', length: 50, default: 'soft_lock' })
    auto_lock_behavior: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
