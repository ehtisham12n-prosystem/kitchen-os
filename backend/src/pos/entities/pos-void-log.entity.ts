import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Order } from './order.entity';

@Entity('pos_void_logs')
@Index(['order_id'])
@Index(['client_id', 'branch_id', 'created_at'])
export class PosVoidLog {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'order_id' })
  order_id: number;

  @Column({ name: 'client_id', type: 'varchar', length: 20, nullable: true })
  client_id: string | null;

  @Column({ name: 'branch_id', type: 'int', nullable: true })
  branch_id: number | null;

  @Column({ name: 'order_number', type: 'varchar', length: 50, nullable: true })
  order_number: string | null;

  @Column({ name: 'receipt_number', type: 'varchar', length: 50, nullable: true })
  receipt_number: string | null;

  @Column({ name: 'customer_id', type: 'int', nullable: true })
  customer_id: number | null;

  @Column({ name: 'customer_name', type: 'varchar', length: 150, nullable: true })
  customer_name: string | null;

  @Column({ name: 'order_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  order_amount: number;

  @Column({ name: 'voided_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  voided_amount: number;

  @Column({ name: 'reason', type: 'varchar', length: 255, nullable: true })
  reason: string | null;

  @Column({ name: 'approved_by', type: 'varchar', length: 150, nullable: true })
  approved_by: string | null;

  @Column({ name: 'voided_by_user_id', type: 'int', nullable: true })
  voided_by_user_id: number | null;

  @Column({ name: 'voided_by_username', type: 'varchar', length: 150, nullable: true })
  voided_by_username: string | null;

  @Column({ name: 'voided_by_role', type: 'varchar', length: 150, nullable: true })
  voided_by_role: string | null;

  @Column({ name: 'sale_counter_id', type: 'int', nullable: true })
  sale_counter_id: number | null;

  @Column({ name: 'sale_counter_name', type: 'varchar', length: 150, nullable: true })
  sale_counter_name: string | null;

  @Column({ name: 'original_payment_method', type: 'varchar', length: 80, nullable: true })
  original_payment_method: string | null;

  @Column({ name: 'original_order_status', type: 'varchar', length: 40, nullable: true })
  original_order_status: string | null;

  @Column({ name: 'original_payment_status', type: 'varchar', length: 40, nullable: true })
  original_payment_status: string | null;

  @Column({ name: 'metadata', type: 'json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  created_at: Date;
}
