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
import { Vendor } from '../../inventory/entities/vendor.entity';
import { PurchaseOrder } from './purchase-order.entity';
import { GoodsReceiptNoteItem } from './goods-receipt-note-item.entity';
import {
  GRN_PAYMENT_STATUSES,
  GRN_PURCHASE_SOURCE_TYPES,
  PROCUREMENT_PAYABLE_STATUSES,
  type GrnPaymentStatus,
  type GrnPurchaseSourceType,
  type ProcurementPayableStatus,
} from '../procurement.constants';

@Entity('goods_receipt_notes')
@Index(['client_id', 'grn_number'], { unique: true })
@Index(['client_id', 'branch_id'])
@Index(['client_id', 'purchase_order_id'])
export class GoodsReceiptNote {
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

  @ManyToOne(() => PurchaseOrder, { nullable: true })
  @JoinColumn({ name: 'purchase_order_id' })
  purchase_order: PurchaseOrder | null;

  @Column({ name: 'purchase_order_id', type: 'int', nullable: true })
  purchase_order_id: number | null;

  @ManyToOne(() => Vendor, { nullable: true })
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor | null;

  @Column({ name: 'vendor_id', type: 'int', nullable: true })
  vendor_id: number | null;

  @Column({
    name: 'purchase_source_type',
    type: 'enum',
    enum: GRN_PURCHASE_SOURCE_TYPES,
    default: 'PO',
  })
  purchase_source_type: GrnPurchaseSourceType;

  @Column({ name: 'grn_number', type: 'varchar', length: 50 })
  grn_number: string;

  @Column({ name: 'receipt_date', type: 'datetime' })
  receipt_date: Date;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ['posted', 'voided'],
    default: 'posted',
  })
  status: 'posted' | 'voided';

  @Column({ name: 'vendor_invoice_number', type: 'varchar', length: 100, nullable: true })
  vendor_invoice_number: string | null;

  @Column({ name: 'vendor_bill_reference', type: 'varchar', length: 100, nullable: true })
  vendor_bill_reference: string | null;

  @Column({ name: 'vendor_bill_date', type: 'date', nullable: true })
  vendor_bill_date: Date | null;

  @Column({ name: 'vendor_bill_due_date', type: 'date', nullable: true })
  vendor_bill_due_date: Date | null;

  @Column({ name: 'vendor_bill_amount', type: 'decimal', precision: 15, scale: 4, nullable: true })
  vendor_bill_amount: number | null;

  @Column({ name: 'payment_terms_snapshot', type: 'varchar', length: 100, nullable: true })
  payment_terms_snapshot: string | null;

  @Column({
    name: 'payable_status',
    type: 'enum',
    enum: PROCUREMENT_PAYABLE_STATUSES,
    default: 'pending_bill',
  })
  payable_status: ProcurementPayableStatus;

  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: GRN_PAYMENT_STATUSES,
    default: 'CREDIT',
  })
  payment_status: GrnPaymentStatus;

  @Column({ name: 'paid_amount', type: 'decimal', precision: 18, scale: 2, nullable: true })
  paid_amount: number | null;

  @Column({ name: 'outstanding_amount', type: 'decimal', precision: 18, scale: 2, nullable: true })
  outstanding_amount: number | null;

  @Column({ name: 'payment_method', type: 'varchar', length: 100, nullable: true })
  payment_method: string | null;

  @Column({ name: 'payment_reference', type: 'varchar', length: 255, nullable: true })
  payment_reference: string | null;

  @Column({ name: 'payment_date', type: 'date', nullable: true })
  payment_date: Date | null;

  @Column({ name: 'payment_source', type: 'varchar', length: 100, nullable: true })
  payment_source: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'received_by', type: 'varchar', length: 100, nullable: true })
  received_by: string | null;

  @Column({ name: 'received_by_name', type: 'varchar', length: 150, nullable: true })
  received_by_name: string | null;

  @OneToMany(() => GoodsReceiptNoteItem, (item) => item.grn, { cascade: true })
  items: GoodsReceiptNoteItem[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

