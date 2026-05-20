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
import { UserManagement } from '../../setup/entities/UserManagement.entity';
import { SaleCounter } from './sale-counter.entity';
import { BusinessDay } from './business-day.entity';
import { ShiftTemplate } from './shift-template.entity';

@Entity('shifts')
@Index(['client_id', 'branch_id'])
@Index(['client_id', 'branch_id', 'external_shift_id'])
export class Shift {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Client)
    @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
    client: Client;

    @Column({ name: 'client_id', type: 'varchar', length: 20 })
    client_id: string;

    @ManyToOne(() => Branch)
    @JoinColumn({ name: 'branch_id' })
    branch: Branch;

    @Column({ name: 'branch_id' })
    branch_id: number;

    @ManyToOne(() => BusinessDay, { nullable: true })
    @JoinColumn({ name: 'business_day_id' })
    business_day: BusinessDay | null;

    @Column({ name: 'business_day_id', type: 'int', nullable: true })
    business_day_id: number | null;

    @ManyToOne(() => ShiftTemplate, { nullable: true })
    @JoinColumn({ name: 'shift_template_id' })
    shift_template: ShiftTemplate | null;

    @Column({ name: 'shift_template_id', type: 'int', nullable: true })
    shift_template_id: number | null;

    @ManyToOne(() => UserManagement)
    @JoinColumn({ name: 'user_id' })
    cashier: UserManagement;

    @Column({ name: 'user_id' })
    user_id: number;

    @ManyToOne(() => SaleCounter, { nullable: true })
    @JoinColumn({ name: 'sale_counter_id' })
    sale_counter: SaleCounter | null;

    @Column({ name: 'sale_counter_id', type: 'int', nullable: true })
    sale_counter_id: number | null;

    @Column({ name: 'shift_name', type: 'varchar', length: 100, nullable: true })
    shift_name: string | null;

    @Column({ name: 'shift_code', type: 'varchar', length: 50, nullable: true })
    shift_code: string | null;

    @Column({ name: 'shift_order', type: 'int', nullable: true })
    shift_order: number | null;

    @Column({ name: 'external_shift_id', type: 'varchar', length: 100, nullable: true })
    external_shift_id: string | null;

    @Column({ name: 'source_device_id', type: 'int', nullable: true })
    source_device_id: number | null;

    @Column({ name: 'source_device_uid', type: 'varchar', length: 100, nullable: true })
    source_device_uid: string | null;

    @Column({
        name: 'sync_origin',
        type: 'enum',
        enum: ['online', 'offline'],
        default: 'online',
    })
    sync_origin: string;

    @Column({
        name: 'opening_float',
        type: 'decimal',
        precision: 12,
        scale: 2,
        default: 0,
    })
    opening_float: number;

    @Column({
        name: 'expected_cash',
        type: 'decimal',
        precision: 12,
        scale: 2,
        default: 0,
    })
    expected_cash: number;

    @Column({
        name: 'actual_cash',
        type: 'decimal',
        precision: 12,
        scale: 2,
        nullable: true,
    })
    actual_cash: number;

    @Column({
        name: 'variance',
        type: 'decimal',
        precision: 12,
        scale: 2,
        default: 0,
    })
    variance: number;

    @Column({
        name: 'status',
        type: 'enum',
        enum: ['open', 'closed'],
        default: 'open',
    })
    status: string;

    @Column({ name: 'opened_at', type: 'datetime' })
    opened_at: Date;

    @Column({ name: 'closed_at', type: 'datetime', nullable: true })
    closed_at: Date | null;

    @Column({ name: 'business_date', type: 'date', nullable: true })
    business_date: string | null;

    @Column({ name: 'planned_start', type: 'datetime', nullable: true })
    planned_start: Date | null;

    @Column({ name: 'planned_end', type: 'datetime', nullable: true })
    planned_end: Date | null;

    @Column({ name: 'actual_start', type: 'datetime', nullable: true })
    actual_start: Date | null;

    @Column({ name: 'actual_end', type: 'datetime', nullable: true })
    actual_end: Date | null;

    @Column({ name: 'is_day_open', type: 'boolean', default: false })
    is_day_open: boolean;

    @ManyToOne(() => UserManagement, { nullable: true })
    @JoinColumn({ name: 'supervisor_id' })
    supervisor: UserManagement;

    @Column({ name: 'supervisor_id', nullable: true })
    supervisor_id: number | null;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}

