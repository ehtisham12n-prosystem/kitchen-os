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
import { Shift } from './shift.entity';
import { SaleCounter } from './sale-counter.entity';
import { UserManagement } from '../../setup/entities/UserManagement.entity';

/**
 * AuthorizedTill - tracks which Sale Counters (Tills) are authorized for a
 * specific branch shift and the float assigned to each by the Manager.
 *
 * Life-cycle:
 *   1. Manager calls `startBusinessDay` → creates Shift + AuthorizedTill rows for each selected counter.
 *   2. Cashier opens their terminal → reads assigned_float (they cannot change it).
 *   3. Cashier submits blind count → blind_count is recorded, terminal_status = 'blind_submitted'.
 *   4. Manager reconciles → sees expected_cash vs blind_count, closes terminal.
 */
@Entity('authorized_tills')
@Index(['client_id', 'branch_id', 'shift_id'])
@Index(['client_id', 'branch_id', 'shift_id', 'sale_counter_id'])
@Index(['client_id', 'branch_id', 'external_session_id'], { unique: true })
export class AuthorizedTill {
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

    @ManyToOne(() => Shift, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'shift_id' })
    shift: Shift;

    @Column({ name: 'shift_id' })
    shift_id: number;

    @ManyToOne(() => SaleCounter)
    @JoinColumn({ name: 'sale_counter_id' })
    sale_counter: SaleCounter;

    @Column({ name: 'sale_counter_id' })
    sale_counter_id: number;

    @Column({ name: 'external_session_id', type: 'varchar', length: 100, nullable: true })
    external_session_id: string | null;

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
    sync_origin: 'online' | 'offline';

    /** Opening float assigned by Manager for this specific counter. */
    @Column({ name: 'assigned_float', type: 'decimal', precision: 12, scale: 2, default: 0 })
    assigned_float: number;

    @Column({ name: 'opening_verified_cash', type: 'decimal', precision: 12, scale: 2, nullable: true })
    opening_verified_cash: number | null;

    @Column({ name: 'opening_verified_at', type: 'datetime', nullable: true })
    opening_verified_at: Date | null;

    @Column({ name: 'opening_verified_by_user_id', type: 'int', nullable: true })
    opening_verified_by_user_id: number | null;

    /**
     * Cashier's blind count (submitted without seeing expected amount).
     * Null until the cashier submits their count.
     */
    @Column({ name: 'blind_count', type: 'decimal', precision: 12, scale: 2, nullable: true })
    blind_count: number | null;

    /**
     * System-calculated expected cash at the time the till is closed.
     * Populated during manager reconciliation.
     */
    @Column({ name: 'expected_cash', type: 'decimal', precision: 12, scale: 2, nullable: true })
    expected_cash: number | null;

    /** Variance = blind_count - expected_cash. Null until reconciled. */
    @Column({ name: 'variance', type: 'decimal', precision: 12, scale: 2, nullable: true })
    variance: number | null;

    /**
     * open          - authorized but terminal session not yet started
     * active        - cashier is operating this till
     * blind_submitted - cashier submitted count, awaiting manager reconciliation
     * closed        - manager has reconciled and closed this till
     */
    @Column({
        name: 'terminal_status',
        type: 'enum',
        enum: ['open', 'active', 'blind_submitted', 'closed'],
        default: 'open',
    })
    terminal_status: 'open' | 'active' | 'blind_submitted' | 'closed';

    /** ISO timestamp when cashier submitted their blind count. */
    @Column({ name: 'blind_submitted_at', type: 'datetime', nullable: true })
    blind_submitted_at: Date | null;

    /** ISO timestamp when manager closed this till. */
    @Column({ name: 'reconciled_at', type: 'datetime', nullable: true })
    reconciled_at: Date | null;

    @Column({ name: 'reconciled_by_user_id', type: 'int', nullable: true })
    reconciled_by_user_id: number | null;

    /** Optional notes from the manager during reconciliation. */
    @Column({ name: 'reconciliation_notes', type: 'text', nullable: true })
    reconciliation_notes: string | null;

    /** ISO timestamp when cashier activated this till session. */
    @Column({ name: 'activated_at', type: 'datetime', nullable: true })
    activated_at: Date | null;

    /** The cashier who operated this till during the session. */
    @ManyToOne(() => UserManagement, { nullable: true })
    @JoinColumn({ name: 'user_id' })
    user: UserManagement | null;

    @Column({ name: 'user_id', type: 'int', nullable: true })
    user_id: number | null;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}

