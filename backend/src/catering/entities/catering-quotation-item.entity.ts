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
import { Client } from '../../platform/entities/client.entity';
import { Product } from '../../catalog/entities/product.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { Recipe } from '../../recipe/entities/recipe.entity';
import {
  CATERING_QUOTATION_ITEM_TYPES,
  CATERING_SUPPLY_STRATEGIES,
  type CateringQuotationItemType,
  type CateringSupplyStrategy,
} from '../catering.constants';
import { CateringQuotation } from './catering-quotation.entity';

@Entity('catering_quotation_items')
@Index(['client_id', 'quotation_id'])
export class CateringQuotationItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @ManyToOne(() => CateringQuotation, (quotation) => quotation.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quotation_id' })
  quotation: CateringQuotation;

  @Column({ name: 'quotation_id', type: 'int' })
  quotation_id: number;

  @Column({
    name: 'item_type',
    type: 'enum',
    enum: CATERING_QUOTATION_ITEM_TYPES,
    default: 'product',
  })
  item_type: CateringQuotationItemType;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product: Product | null;

  @Column({ name: 'product_id', type: 'int', nullable: true })
  product_id: number | null;

  @ManyToOne(() => InventoryItem, { nullable: true })
  @JoinColumn({ name: 'inventory_item_id' })
  inventory_item: InventoryItem | null;

  @Column({ name: 'inventory_item_id', type: 'int', nullable: true })
  inventory_item_id: number | null;

  @ManyToOne(() => Recipe, { nullable: true })
  @JoinColumn({ name: 'recipe_id' })
  recipe: Recipe | null;

  @Column({ name: 'recipe_id', type: 'int', nullable: true })
  recipe_id: number | null;

  @Column({ name: 'line_description', type: 'varchar', length: 255 })
  line_description: string;

  @Column({ name: 'quantity', type: 'decimal', precision: 12, scale: 4, default: 0 })
  quantity: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 12, scale: 2, default: 0 })
  unit_price: number;

  @Column({ name: 'line_total', type: 'decimal', precision: 12, scale: 2, default: 0 })
  line_total: number;

  @Column({ name: 'estimated_unit_cost', type: 'decimal', precision: 12, scale: 4, default: 0 })
  estimated_unit_cost: number;

  @Column({ name: 'estimated_total_cost', type: 'decimal', precision: 12, scale: 2, default: 0 })
  estimated_total_cost: number;

  @Column({
    name: 'supply_strategy',
    type: 'enum',
    enum: CATERING_SUPPLY_STRATEGIES,
    default: 'none',
  })
  supply_strategy: CateringSupplyStrategy;

  @Column({ name: 'service_notes', type: 'text', nullable: true })
  service_notes: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

