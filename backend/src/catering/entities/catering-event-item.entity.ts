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
import { CateringEvent } from './catering-event.entity';

@Entity('catering_event_items')
@Index(['client_id', 'event_id'])
export class CateringEventItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @ManyToOne(() => CateringEvent, (event) => event.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: CateringEvent;

  @Column({ name: 'event_id', type: 'int' })
  event_id: number;

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

  @Column({
    name: 'item_type',
    type: 'enum',
    enum: CATERING_QUOTATION_ITEM_TYPES,
    default: 'product',
  })
  item_type: CateringQuotationItemType;

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

  @Column({ name: 'production_notes', type: 'text', nullable: true })
  production_notes: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

