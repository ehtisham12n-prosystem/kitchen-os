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
import { Order } from './order.entity';
import { Product } from '../../catalog/entities/product.entity';

@Entity('order_items')
@Index(['order_id'])
export class OrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'order_id' })
  order_id: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'product_id' })
  product_id: number; // Linked directly to catalog. Products should be soft-deleted, not hard-deleted, to keep historical receipts working.

  @Column({ name: 'product_name', type: 'varchar', length: 200, nullable: true })
  product_name: string | null; // Immutable sale-time snapshot. Keep independent from the live catalog name for audit-safe receipts/history.

  @Column({ name: 'item_price', type: 'decimal', precision: 10, scale: 2 })
  item_price: number; // Locked price at the moment of sale. Do NOT reference product_base_price dynamically.

  @Column({ name: 'quantity', type: 'int', default: 1 })
  quantity: number;

  @Column({
    name: 'item_status',
    type: 'enum',
    enum: ['pending', 'cooking', 'ready', 'served', 'voided'],
    default: 'pending',
  })
  item_status: string; // Used heavily by the Kitchen Display System (KDS)

  @Column({ name: 'item_notes', type: 'varchar', length: 255, nullable: true })
  item_notes: string | null; // e.g. "No Onions"

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
