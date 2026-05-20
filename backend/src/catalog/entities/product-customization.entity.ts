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
import { Product } from './product.entity';

@Entity('product_customizations')
@Index(['product_id'])
export class ProductCustomization {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'product_id' })
  product_id: number;

  @Column({ name: 'customization_type', length: 100 })
  customization_type: string; // e.g. "Size", "Crust", "Topping"

  @Column({ name: 'customization_value', length: 100 })
  customization_value: string; // e.g. "Large", "Stuffed", "Extra Cheese"

  @Column({
    name: 'customization_price_delta',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  customization_price_delta: number; // e.g., +2.00 or -1.00

  @Column({
    name: 'customization_is_required',
    type: 'boolean',
    default: false,
  })
  customization_is_required: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
