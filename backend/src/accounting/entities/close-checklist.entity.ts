import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { Branch } from '../../setup/entities/branch.entity';
import { Client } from '../../platform/entities/client.entity';

export enum AccountingCloseChecklistStatus {
    PENDING = 'pending',
    COMPLETED = 'completed',
    BLOCKED = 'blocked',
}

@Entity('accounting_close_checklist_items')
@Index(['client_id', 'branch_id', 'period_key', 'item_key'], { unique: true })
export class AccountingCloseChecklistItem {
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

    @Column({ name: 'branch_id', type: 'int' })
    branch_id: number;

    @Column({ name: 'period_key', type: 'varchar', length: 7 })
    period_key: string;

    @Column({ name: 'item_key', type: 'varchar', length: 60 })
    item_key: string;

    @Column({ name: 'item_label', type: 'varchar', length: 120 })
    item_label: string;

    @Column({
        name: 'status',
        type: 'enum',
        enum: AccountingCloseChecklistStatus,
        default: AccountingCloseChecklistStatus.PENDING,
    })
    status: AccountingCloseChecklistStatus;

    @Column({ name: 'notes', type: 'varchar', length: 500, nullable: true })
    notes: string | null;

    @Column({ name: 'completed_by', type: 'varchar', length: 100, nullable: true })
    completed_by: string | null;

    @Column({ name: 'completed_at', type: 'datetime', nullable: true })
    completed_at: Date | null;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
