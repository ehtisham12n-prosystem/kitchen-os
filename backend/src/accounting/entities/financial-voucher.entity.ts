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
import { ChartOfAccount } from './chart-of-accounts.entity';
import { JournalEntry } from './journal-entry.entity';
import { GoodsReceiptNote } from '../../inventory-op/entities/goods-receipt-note.entity';

export enum VoucherType {
  EXPENSE = 'EXPENSE',
  PAYMENT = 'PAYMENT',
  COMPENSATION = 'COMPENSATION',
  PURCHASE_CREDIT_NOTE = 'PURCHASE_CREDIT_NOTE',
}

export enum PartyType {
  VENDOR = 'VENDOR',
  EMPLOYEE = 'EMPLOYEE',
  OTHER = 'OTHER',
}

export enum VoucherStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  VOID = 'VOID',
}

@Entity('financial_vouchers')
@Index(['client_id', 'branch_id'])
@Index(['voucher_no'], { unique: true })
export class FinancialVoucher {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'voucher_no', length: 50 })
  voucher_no: string;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ name: 'branch_id', nullable: true })
  branch_id: number;

  @Column({
    type: 'enum',
    enum: VoucherType,
    default: VoucherType.EXPENSE,
  })
  type: VoucherType;

  @Column({
    name: 'party_type',
    type: 'enum',
    enum: PartyType,
    default: PartyType.OTHER,
  })
  party_type: PartyType;

  @Column({ name: 'party_id', length: 50, nullable: true })
  party_id: string; // Could be Vendor ID, Employee ID, etc.

  @Column({ name: 'party_name', length: 200, nullable: true })
  party_name: string; // Store name for quick display/denormalization

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  amount: number;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'payment_method', length: 50, nullable: true })
  payment_method: string;

  @Column({ name: 'payment_source_label', type: 'varchar', length: 120, nullable: true })
  payment_source_label: string | null;

  @ManyToOne(() => GoodsReceiptNote, { nullable: true })
  @JoinColumn({ name: 'linked_grn_id' })
  linked_grn: GoodsReceiptNote | null;

  @Column({ name: 'linked_grn_id', type: 'int', nullable: true })
  linked_grn_id: number | null;

  @ManyToOne(() => ChartOfAccount, { nullable: true })
  @JoinColumn({ name: 'expense_account_id' })
  expense_account: ChartOfAccount | null;

  @Column({ name: 'expense_account_id', type: 'int', nullable: true })
  expense_account_id: number | null;

  @ManyToOne(() => ChartOfAccount, { nullable: true })
  @JoinColumn({ name: 'treasury_account_id' })
  treasury_account: ChartOfAccount | null;

  @Column({ name: 'treasury_account_id', type: 'int', nullable: true })
  treasury_account_id: number | null;

  @Column({
    type: 'enum',
    enum: VoucherStatus,
    default: VoucherStatus.PENDING,
  })
  status: VoucherStatus;

  @Column({ name: 'status_note', type: 'text', nullable: true })
  status_note: string | null;

  @Column({ name: 'reference_no', length: 100, nullable: true })
  reference_no: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'created_by', nullable: true })
  created_by: number;

  @ManyToOne(() => JournalEntry, { nullable: true })
  @JoinColumn({ name: 'posted_journal_entry_id' })
  posted_journal_entry: JournalEntry | null;

  @Column({ name: 'posted_journal_entry_id', type: 'int', nullable: true })
  posted_journal_entry_id: number | null;

  @ManyToOne(() => JournalEntry, { nullable: true })
  @JoinColumn({ name: 'reversal_journal_entry_id' })
  reversal_journal_entry: JournalEntry | null;

  @Column({ name: 'reversal_journal_entry_id', type: 'int', nullable: true })
  reversal_journal_entry_id: number | null;

  @Column({ name: 'approved_at', type: 'datetime', nullable: true })
  approved_at: Date | null;

  @Column({ name: 'approved_by', type: 'int', nullable: true })
  approved_by: number | null;

  @Column({ name: 'rejected_at', type: 'datetime', nullable: true })
  rejected_at: Date | null;

  @Column({ name: 'rejected_by', type: 'int', nullable: true })
  rejected_by: number | null;

  @Column({ name: 'voided_at', type: 'datetime', nullable: true })
  voided_at: Date | null;

  @Column({ name: 'voided_by', type: 'int', nullable: true })
  voided_by: number | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

