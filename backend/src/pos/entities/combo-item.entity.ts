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
import { Product } from '../../catalog/entities/product.entity';
import { Combo } from './combo.entity';

@Entity('pos_combo_items')
@Index(['combo_id'])
export class ComboItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Combo, (combo) => combo.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'combo_id' })
  combo: Combo;

  @Column({ name: 'combo_id' })
  combo_id: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'product_id' })
  product_id: number;

  @Column({ name: 'quantity', type: 'decimal', precision: 10, scale: 3, default: 1 })
  quantity: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
