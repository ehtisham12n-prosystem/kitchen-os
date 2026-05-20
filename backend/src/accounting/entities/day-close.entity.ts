import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Client } from '../../platform/entities/client.entity';
import { Branch } from '../../setup/entities/branch.entity';
import { JournalEntry } from './journal-entry.entity';

@Entity('accounting_day_closes')
@Index(['client_id', 'branch_id', 'business_date'], { unique: true })
@Index(['client_id', 'branch_id', 'closed_at'])
export class AccountingDayClose {
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

  @Column({ name: 'business_date', type: 'date' })
  business_date: string;

  @Column({ name: 'closed_at', type: 'datetime' })
  closed_at: Date;

  @Column({ name: 'closed_by_user_id', type: 'int', nullable: true })
  closed_by_user_id: number | null;

  @Column({ name: 'closed_by_name', type: 'varchar', length: 150, nullable: true })
  closed_by_name: string | null;

  @Column({ name: 'shift_id', type: 'int', nullable: true })
  shift_id: number | null;

  @Column({ name: 'order_count', type: 'int', default: 0 })
  order_count: number;

  @Column({ name: 'gross_sales_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  gross_sales_amount: number;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  discount_amount: number;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  tax_amount: number;

  @Column({ name: 'other_charges_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  other_charges_amount: number;

  @Column({ name: 'net_sales_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  net_sales_amount: number;

  @Column({ name: 'cash_sales_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  cash_sales_amount: number;

  @Column({ name: 'bank_sales_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  bank_sales_amount: number;

  @Column({ name: 'card_sales_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  card_sales_amount: number;

  @Column({ name: 'digital_wallet_sales_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  digital_wallet_sales_amount: number;

  @Column({ name: 'other_payment_sales_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  other_payment_sales_amount: number;

  @Column({ name: 'inventory_issue_cost_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  inventory_issue_cost_amount: number;

  @Column({ name: 'wastage_cost_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  wastage_cost_amount: number;

  @Column({ name: 'expected_cash_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  expected_cash_amount: number;

  @Column({ name: 'actual_cash_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  actual_cash_amount: number;

  @Column({ name: 'cash_variance_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  cash_variance_amount: number;

  @Column({ name: 'journal_entry_count', type: 'int', default: 0 })
  journal_entry_count: number;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => JournalEntry, (entry) => entry.day_close)
  journal_entries: JournalEntry[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

