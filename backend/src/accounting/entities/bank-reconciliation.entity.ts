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
import { ChartOfAccount } from './chart-of-accounts.entity';
import { JournalEntry } from './journal-entry.entity';
import { JournalItem } from './journal-item.entity';

@Entity('accounting_bank_reconciliations')
@Index(['client_id', 'branch_id', 'account_id'])
@Index(['journal_item_id'], { unique: true })
export class AccountingBankReconciliation {
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

  @ManyToOne(() => ChartOfAccount)
  @JoinColumn({ name: 'account_id' })
  account: ChartOfAccount;

  @Column({ name: 'account_id', type: 'int' })
  account_id: number;

  @ManyToOne(() => JournalEntry)
  @JoinColumn({ name: 'journal_entry_id' })
  journal_entry: JournalEntry;

  @Column({ name: 'journal_entry_id', type: 'int' })
  journal_entry_id: number;

  @ManyToOne(() => JournalItem)
  @JoinColumn({ name: 'journal_item_id' })
  journal_item: JournalItem;

  @Column({ name: 'journal_item_id', type: 'int' })
  journal_item_id: number;

  @Column({ name: 'statement_date', type: 'date' })
  statement_date: string;

  @Column({ name: 'statement_reference', type: 'varchar', length: 100 })
  statement_reference: string;

  @Column({ name: 'statement_description', type: 'varchar', length: 255, nullable: true })
  statement_description: string | null;

  @Column({ name: 'reconciled_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  reconciled_amount: number;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'reconciled_by_user_id', type: 'int', nullable: true })
  reconciled_by_user_id: number | null;

  @Column({ name: 'reconciled_by_name', type: 'varchar', length: 150, nullable: true })
  reconciled_by_name: string | null;

  @Column({ name: 'reconciled_at', type: 'datetime' })
  reconciled_at: Date;

  @CreateDateColumn()
  created_at: Date;
}

