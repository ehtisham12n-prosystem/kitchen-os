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
import { Branch } from '../../setup/entities/branch.entity';

@Entity('customers')
@Index(['client_id', 'phone_number'], { unique: true })
export class Customer {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Client)
    @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
    client: Client;

    @Column({ name: 'client_id', type: 'varchar', length: 20 })
    client_id: string;

    @Column({ name: 'name', length: 150 })
    name: string;

    @Column({ name: 'customer_code', type: 'varchar', length: 40, nullable: true })
    customer_code: string | null;

    @Column({ name: 'phone_number', type: 'varchar', length: 20, nullable: true })
    phone_number: string | null;

    @Column({ name: 'email', type: 'varchar', length: 150, nullable: true })
    email: string | null;

    @Column({ name: 'password_hash', length: 255, nullable: true })
    password_hash: string;

    @Column({
        type: 'enum',
        enum: ['active', 'inactive', 'suspended'],
        default: 'active'
    })
    status: string;

    @Column({
        name: 'gender',
        type: 'enum',
        enum: ['male', 'female', 'other', 'prefer_not_to_say'],
        nullable: true,
    })
    gender: string | null;

    @ManyToOne(() => Branch, { nullable: true })
    @JoinColumn({ name: 'preferred_branch_id' })
    preferred_branch: Branch | null;

    @Column({ name: 'preferred_branch_id', type: 'int', nullable: true })
    preferred_branch_id: number | null;

    @Column({ name: 'address_line_1', type: 'varchar', length: 255, nullable: true })
    address_line_1: string | null;

    @Column({ name: 'address_line_2', type: 'varchar', length: 255, nullable: true })
    address_line_2: string | null;

    @Column({ name: 'city', type: 'varchar', length: 100, nullable: true })
    city: string | null;

    @Column({ name: 'country', type: 'varchar', length: 100, nullable: true })
    country: string | null;

    @Column({ name: 'designation', type: 'varchar', length: 120, nullable: true })
    designation: string | null;

    @Column({ name: 'organization', type: 'varchar', length: 150, nullable: true })
    organization: string | null;

    @Column({ name: 'allow_credit', type: 'boolean', default: false })
    allow_credit: boolean;

    @Column({ name: 'credit_limit', type: 'decimal', precision: 12, scale: 2, default: 0 })
    credit_limit: number;

    @Column({
        name: 'credit_control_mode',
        type: 'enum',
        enum: ['warn', 'block'],
        default: 'block',
    })
    credit_control_mode: 'warn' | 'block';

    @Column({ name: 'collection_follow_up_date', type: 'date', nullable: true })
    collection_follow_up_date: string | null;

    @Column({ name: 'collection_follow_up_note', type: 'varchar', length: 500, nullable: true })
    collection_follow_up_note: string | null;

    @Column({ name: 'notes', type: 'text', nullable: true })
    notes: string | null;

    @Column({ name: 'marketing_opt_in', type: 'boolean', default: false })
    marketing_opt_in: boolean;

    @Column({ name: 'wallet_balance', type: 'decimal', precision: 10, scale: 2, default: 0 })
    wallet_balance: number;

    @Column({ name: 'loyalty_points', type: 'int', default: 0 })
    loyalty_points: number;

    @Column({ name: 'loyalty_points_lifetime', type: 'int', default: 0 })
    loyalty_points_lifetime: number;

    @Column({ name: 'last_visit_at', type: 'datetime', nullable: true })
    last_visit_at: Date | null;

    @Column({ name: 'last_order_at', type: 'datetime', nullable: true })
    last_order_at: Date | null;

    @Column({ name: 'total_orders', type: 'int', default: 0 })
    total_orders: number;

    @Column({ name: 'total_spent', type: 'decimal', precision: 12, scale: 2, default: 0 })
    total_spent: number;

    @Column({ name: 'average_order_value', type: 'decimal', precision: 12, scale: 2, default: 0 })
    average_order_value: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}

