import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrderReturn } from './order-return.entity';
import { OrderItem } from './order-item.entity';

@Entity('order_return_items')
@Index(['return_id'])
@Index(['order_item_id'])
export class OrderReturnItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => OrderReturn)
  @JoinColumn({ name: 'return_id' })
  return_record: OrderReturn;

  @Column({ name: 'return_id' })
  return_id: number;

  @ManyToOne(() => OrderItem)
  @JoinColumn({ name: 'order_item_id' })
  order_item: OrderItem;

  @Column({ name: 'order_item_id' })
  order_item_id: number;

  @Column({ name: 'product_id', type: 'int' })
  product_id: number;

  @Column({ name: 'product_name', type: 'varchar', length: 150 })
  product_name: string;

  @Column({ name: 'quantity', type: 'int', default: 1 })
  quantity: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 2, default: 0 })
  unit_price: number;

  @Column({ name: 'base_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  base_amount: number;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  discount_amount: number;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  tax_amount: number;

  @Column({ name: 'service_charge_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  service_charge_amount: number;

  @Column({ name: 'refund_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  refund_amount: number;

  @CreateDateColumn()
  created_at: Date;
}
