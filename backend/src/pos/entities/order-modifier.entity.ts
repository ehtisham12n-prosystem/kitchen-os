import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { OrderItem } from './order-item.entity';

@Entity('order_modifiers')
@Index(['order_item_id'])
export class OrderModifier {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => OrderItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_item_id' })
  order_item: OrderItem;

  @Column({ name: 'order_item_id' })
  order_item_id: number;

  @Column({ name: 'modifier_name', type: 'varchar', length: 120 })
  modifier_name: string;

  @ManyToOne(() => InventoryItem, { nullable: true })
  @JoinColumn({ name: 'ingredient_item_id' })
  ingredient_item: InventoryItem | null;

  @Column({ name: 'ingredient_item_id', type: 'int', nullable: true })
  ingredient_item_id: number | null;

  @Column({ name: 'qty_impact', type: 'decimal', precision: 15, scale: 4, default: 0 })
  qty_impact: number;

  @Column({ name: 'uom', type: 'varchar', length: 50, nullable: true })
  uom: string | null;

  @Column({ name: 'price_impact', type: 'decimal', precision: 12, scale: 2, default: 0 })
  price_impact: number;

  @Column({ name: 'behavior', type: 'enum', enum: ['add', 'skip'], default: 'add' })
  behavior: 'add' | 'skip';

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
