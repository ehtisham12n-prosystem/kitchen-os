import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Client } from '../../platform/entities/client.entity';

@Entity('deals_vouchers')
@Index(['client_id', 'code'], { unique: true })
export class Voucher {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Client)
    @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
    client: Client;

    @Column({ name: 'client_id', type: 'varchar', length: 20 })
    client_id: string;

    @Column({ name: 'code', length: 50 })
    code: string;

    @Column({ name: 'name', type: 'varchar', length: 120, nullable: true })
    name: string | null;

    @Column({ name: 'description', type: 'text', nullable: true })
    description: string | null;

    @Column({
        name: 'discount_type',
        type: 'enum',
        enum: ['percentage', 'fixed_amount'],
        default: 'percentage',
    })
    discount_type: string;

    @Column({ name: 'discount_value', type: 'decimal', precision: 10, scale: 2 })
    discount_value: number;

    @Column({ name: 'min_order_value', type: 'decimal', precision: 10, scale: 2, default: 0 })
    min_order_value: number;

    @Column({ name: 'max_discount_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
    max_discount_amount: number;

    @Column({ name: 'start_date', type: 'datetime', nullable: true })
    start_date: Date;

    @Column({ name: 'end_date', type: 'datetime', nullable: true })
    end_date: Date;

    @Column({ name: 'is_active', type: 'boolean', default: true })
    is_active: boolean;

    @Column({ name: 'usage_limit', type: 'int', nullable: true })
    usage_limit: number;

    @Column({ name: 'usage_count', type: 'int', default: 0 })
    usage_count: number;

    @Column({ name: 'branch_availability', type: 'json', nullable: true })
    branchAvailability: Record<string, boolean> | null;

    @Column({ name: 'applicable_order_types', type: 'json', nullable: true })
    applicable_order_types: string[] | null;

    @Column({ name: 'customer_required', type: 'boolean', default: false })
    customer_required: boolean;

    @Column({ name: 'per_customer_limit', type: 'int', nullable: true })
    per_customer_limit: number | null;

    @Column({ name: 'first_order_only', type: 'boolean', default: false })
    first_order_only: boolean;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}

