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
import { FinancialVoucher } from './financial-voucher.entity';
import { JournalEntry } from './journal-entry.entity';
import { GoodsReceiptNote } from '../../inventory-op/entities/goods-receipt-note.entity';

@Entity('accounting_payable_allocations')
@Index(['client_id', 'branch_id'])
@Index(['client_id', 'grn_id'])
@Index(['client_id', 'payable_voucher_id'])
@Index(['client_id', 'voucher_id'])
export class AccountingPayableAllocation {
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

  @ManyToOne(() => GoodsReceiptNote, { nullable: true })
  @JoinColumn({ name: 'grn_id' })
  grn: GoodsReceiptNote | null;

  @Column({ name: 'grn_id', type: 'int', nullable: true })
  grn_id: number | null;

  @ManyToOne(() => FinancialVoucher, { nullable: true })
  @JoinColumn({ name: 'payable_voucher_id' })
  payable_voucher: FinancialVoucher | null;

  @Column({ name: 'payable_voucher_id', type: 'int', nullable: true })
  payable_voucher_id: number | null;

  @ManyToOne(() => FinancialVoucher)
  @JoinColumn({ name: 'voucher_id' })
  voucher: FinancialVoucher;

  @Column({ name: 'voucher_id', type: 'int' })
  voucher_id: number;

  @ManyToOne(() => JournalEntry, { nullable: true })
  @JoinColumn({ name: 'journal_entry_id' })
  journal_entry: JournalEntry | null;

  @Column({ name: 'journal_entry_id', type: 'int', nullable: true })
  journal_entry_id: number | null;

  @Column({ name: 'vendor_id', type: 'int', nullable: true })
  vendor_id: number | null;

  @Column({ name: 'allocated_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  allocated_amount: number;

  @Column({ name: 'allocation_date', type: 'date' })
  allocation_date: string;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  created_at: Date;
}

