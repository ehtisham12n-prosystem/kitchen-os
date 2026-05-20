import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { JournalEntry } from './journal-entry.entity';
import { ChartOfAccount } from './chart-of-accounts.entity';

@Entity('accounting_journal_items')
export class JournalItem {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => JournalEntry, (entry) => entry.items)
    @JoinColumn({ name: 'entry_id' })
    entry: JournalEntry;

    @Column({ name: 'entry_id' })
    entry_id: number;

    @ManyToOne(() => ChartOfAccount)
    @JoinColumn({ name: 'account_id' })
    account: ChartOfAccount;

    @Column({ name: 'account_id' })
    account_id: number;

    @Column({
        name: 'debit',
        type: 'decimal',
        precision: 15,
        scale: 2,
        default: 0,
    })
    debit: number;

    @Column({
        name: 'credit',
        type: 'decimal',
        precision: 15,
        scale: 2,
        default: 0,
    })
    credit: number;
}
