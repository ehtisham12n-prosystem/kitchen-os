import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Client } from '../../platform/entities/client.entity';
import { Branch } from '../../setup/entities/branch.entity';
import { KitchenTableEntity } from '../../setup/entities/table.entity';
import { UserManagement } from '../../setup/entities/UserManagement.entity';
import { OrderItem } from './order-item.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { Voucher } from '../../deals/entities/voucher.entity';
import { Shift } from './shift.entity';
import { SaleCounter } from './sale-counter.entity';
import { Transaction } from './transaction.entity';
import { OrderCharge } from './order-charge.entity';
import { OrderReturn } from './order-return.entity';

@Entity('orders')
@Index(['client_id', 'branch_id'])
@Index(['client_id', 'branch_id', 'sync_origin'])
export class Order {
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

  @ManyToOne(() => KitchenTableEntity, { nullable: true })
  @JoinColumn({ name: 'table_id' })
  table: KitchenTableEntity;

  @Column({ name: 'table_id', type: 'int', nullable: true })
  table_id: number | null;

  @ManyToOne(() => UserManagement)
  @JoinColumn({ name: 'user_id' })
  cashier: UserManagement;

  @Column({ name: 'user_id' })
  user_id: number;

  @ManyToOne(() => Shift, { nullable: true })
  @JoinColumn({ name: 'shift_id' })
  shift: Shift | null;

  @Column({ name: 'shift_id', type: 'int', nullable: true })
  shift_id: number | null;

  @ManyToOne(() => SaleCounter, { nullable: true })
  @JoinColumn({ name: 'sale_counter_id' })
  sale_counter: SaleCounter | null;

  @Column({ name: 'sale_counter_id', type: 'int', nullable: true })
  sale_counter_id: number | null;

  @Column({ name: 'order_number', type: 'varchar', length: 50, unique: true, nullable: true })
  order_number: string | null; // e.g., 'ORD-20231023-001'

  @Column({ name: 'kot_base_number', type: 'int', nullable: true })
  kot_base_number: number | null;

  @Column({ name: 'kot_version', type: 'int', default: 0 })
  kot_version: number;

  @Column({ name: 'last_kot_submission_hash', type: 'char', length: 64, nullable: true })
  last_kot_submission_hash: string | null;

  @Column({
    name: 'order_type',
    type: 'enum',
    enum: ['dine_in', 'takeout', 'delivery'],
    default: 'dine_in',
  })
  order_type: string;

  @Column({
    name: 'order_status',
    type: 'enum',
    enum: ['held', 'pending', 'preparing', 'ready', 'served', 'completed', 'cancelled', 'voided'],
    default: 'pending',
  })
  order_status: string;

  @Column({ name: 'sub_total', type: 'decimal', precision: 12, scale: 2, default: 0 })
  sub_total: number;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  tax_amount: number;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  discount_amount: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  total_amount: number;

  @Column({ name: 'payment_status', default: 'unpaid' })
  payment_status: string; // unpaid, partial, paid

  @Column({ name: 'order_note', type: 'text', nullable: true })
  order_note: string | null;

  @Column({ name: 'delivery_details', type: 'json', nullable: true })
  delivery_details: Record<string, unknown> | null;

  @ManyToOne(() => Customer, { nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ name: 'customer_id', type: 'int', nullable: true })
  customer_id: number | null;

  @ManyToOne(() => Voucher, { nullable: true })
  @JoinColumn({ name: 'voucher_id' })
  voucher: Voucher;

  @Column({ name: 'voucher_id', type: 'int', nullable: true })
  voucher_id: number | null;

  @Column({ name: 'receipt_number', type: 'varchar', length: 50, nullable: true })
  receipt_number: string | null;

  @Column({ name: 'voided_at', type: 'datetime', nullable: true })
  voided_at: Date | null;

  @Column({ name: 'void_reason', type: 'varchar', length: 255, nullable: true })
  void_reason: string | null;

  @Column({ name: 'void_authorized_by_user_id', type: 'int', nullable: true })
  void_authorized_by_user_id: number | null;

  @Column({ name: 'void_authorized_by_username', type: 'varchar', length: 150, nullable: true })
  void_authorized_by_username: string | null;

  @Column({ name: 'finalized_at', type: 'datetime', nullable: true })
  finalized_at: Date | null;

  @ManyToOne(() => UserManagement, { nullable: true })
  @JoinColumn({ name: 'finalized_by_user_id' })
  finalized_by: UserManagement | null;

  @Column({ name: 'finalized_by_user_id', type: 'int', nullable: true })
  finalized_by_user_id: number | null;

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
  sync_origin: string;

  @Column({ name: 'offline_created_at', type: 'datetime', nullable: true })
  offline_created_at: Date | null;

  @OneToMany(() => OrderItem, (item) => item.order)
  items: OrderItem[];

  @OneToMany(() => Transaction, (transaction) => transaction.order)
  transactions: Transaction[];

  @OneToMany(() => OrderCharge, (charge) => charge.order)
  charges: OrderCharge[];

  @OneToMany(() => OrderReturn, (returnRecord) => returnRecord.order)
  returns: OrderReturn[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

