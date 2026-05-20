import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { Client } from '../../platform/entities/client.entity';
import { Branch } from '../../setup/entities/branch.entity';
import { JournalEntry } from './journal-entry.entity';

@Entity('accounting_treasury_deposit_allocations')
@Index(['client_id', 'branch_id', 'deposit_entry_id'])
@Index(['client_id', 'branch_id', 'handover_entry_id'])
@Index(['deposit_entry_id', 'handover_entry_id'], { unique: true })
export class AccountingTreasuryDepositAllocation {
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

    @ManyToOne(() => JournalEntry)
    @JoinColumn({ name: 'deposit_entry_id' })
    deposit_entry: JournalEntry;

    @Column({ name: 'deposit_entry_id', type: 'int' })
    deposit_entry_id: number;

    @ManyToOne(() => JournalEntry)
    @JoinColumn({ name: 'handover_entry_id' })
    handover_entry: JournalEntry;

    @Column({ name: 'handover_entry_id', type: 'int' })
    handover_entry_id: number;

    @Column({ name: 'allocated_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    allocated_amount: number;

    @CreateDateColumn()
    created_at: Date;
}
