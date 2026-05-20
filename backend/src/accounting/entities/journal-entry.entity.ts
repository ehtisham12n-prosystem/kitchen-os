import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    OneToMany,
    Index,
} from 'typeorm';
import { Client } from '../../platform/entities/client.entity';
import { Branch } from '../../setup/entities/branch.entity';
import { JournalItem } from './journal-item.entity';
import { AccountingDayClose } from './day-close.entity';

export enum JournalAccrualReversalStatus {
    PENDING = 'pending',
    REVERSED = 'reversed',
}

export enum JournalCloseAdjustmentType {
    PREPAID_EXPENSE = 'prepaid_expense',
    DEFERRED_REVENUE = 'deferred_revenue',
    DEPRECIATION = 'depreciation',
}

@Entity('accounting_journal_entries')
@Index(['client_id', 'branch_id'])
@Index(['client_id', 'branch_id', 'business_date'])
export class JournalEntry {
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

    @Column({ name: 'transaction_date', type: 'datetime' })
    transaction_date: Date;

    @Column({ name: 'business_date', type: 'date' })
    business_date: string;

    @Column({ name: 'description', length: 255, nullable: true })
    description: string;

    @Column({ name: 'reference_id', length: 100, nullable: true })
    reference_id: string; // E.g., ORDER-123, PO-456

    @Column({ name: 'source_module', type: 'varchar', length: 40, nullable: true })
    source_module: string | null;

    @Column({ name: 'source_entity_type', type: 'varchar', length: 40, nullable: true })
    source_entity_type: string | null;

    @Column({ name: 'source_entity_id', type: 'varchar', length: 64, nullable: true })
    source_entity_id: string | null;

    @Column({ name: 'source_event', type: 'varchar', length: 40, nullable: true })
    source_event: string | null;

    @Column({
        name: 'posting_type',
        type: 'enum',
        enum: ['manual', 'auto', 'closing'],
        default: 'manual',
    })
    posting_type: 'manual' | 'auto' | 'closing';

    @ManyToOne(() => AccountingDayClose, (dayClose) => dayClose.journal_entries, { nullable: true })
    @JoinColumn({ name: 'day_close_id' })
    day_close: AccountingDayClose | null;

    @Column({ name: 'day_close_id', type: 'int', nullable: true })
    day_close_id: number | null;

    @Column({ name: 'total_debit', type: 'decimal', precision: 15, scale: 2, default: 0 })
    total_debit: number;

    @Column({ name: 'total_credit', type: 'decimal', precision: 15, scale: 2, default: 0 })
    total_credit: number;

    @ManyToOne(() => JournalEntry, { nullable: true })
    @JoinColumn({ name: 'reversed_entry_id' })
    reversed_entry: JournalEntry | null;

    @Column({ name: 'reversed_entry_id', type: 'int', nullable: true })
    reversed_entry_id: number | null;

    @ManyToOne(() => JournalEntry, { nullable: true })
    @JoinColumn({ name: 'reversal_entry_id' })
    reversal_entry: JournalEntry | null;

    @Column({ name: 'reversal_entry_id', type: 'int', nullable: true })
    reversal_entry_id: number | null;

    @Column({ name: 'reversal_reason', type: 'text', nullable: true })
    reversal_reason: string | null;

    @Column({ name: 'reversed_at', type: 'datetime', nullable: true })
    reversed_at: Date | null;

    @Column({ name: 'is_accrual', type: 'tinyint', width: 1, default: () => '0' })
    is_accrual: boolean;

    @Column({ name: 'accrual_reversal_due_date', type: 'date', nullable: true })
    accrual_reversal_due_date: string | null;

    @Column({
        name: 'accrual_reversal_status',
        type: 'enum',
        enum: JournalAccrualReversalStatus,
        nullable: true,
    })
    accrual_reversal_status: JournalAccrualReversalStatus | null;

    @Column({
        name: 'close_adjustment_type',
        type: 'enum',
        enum: JournalCloseAdjustmentType,
        nullable: true,
    })
    close_adjustment_type: JournalCloseAdjustmentType | null;

    @Column({ name: 'schedule_start_date', type: 'date', nullable: true })
    schedule_start_date: string | null;

    @Column({ name: 'schedule_end_date', type: 'date', nullable: true })
    schedule_end_date: string | null;

    @OneToMany(() => JournalItem, (item) => item.entry, { cascade: true })
    items: JournalItem[];

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}

