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
import { Order } from './order.entity';
import { OrderReturnItem } from './order-return-item.entity';
import { Transaction } from './transaction.entity';

@Entity('order_returns')
@Index(['client_id', 'branch_id'])
@Index(['order_id'])
export class OrderReturn {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'order_id' })
  order_id: number;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @Column({ name: 'branch_id', type: 'int' })
  branch_id: number;

  @Column({ name: 'processed_by_user_id', type: 'int', nullable: true })
  processed_by_user_id: number | null;

  @Column({
    name: 'return_scope',
    type: 'enum',
    enum: ['full', 'partial'],
    default: 'partial',
  })
  return_scope: 'full' | 'partial';

  @Column({ name: 'refund_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  refund_amount: number;

  @Column({ name: 'restock_inventory', type: 'boolean', default: true })
  restock_inventory: boolean;

  @Column({ name: 'return_note', type: 'text', nullable: true })
  return_note: string | null;

  @Column({ name: 'payment_note', type: 'varchar', length: 255, nullable: true })
  payment_note: string | null;

  @OneToMany(() => OrderReturnItem, (item) => item.return_record, { cascade: false })
  items: OrderReturnItem[];

  @OneToMany(() => Transaction, (transaction) => transaction.return_record)
  payments: Transaction[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
