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
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { RecipeIngredient } from '../../recipe/entities/recipe-ingredient.entity';
import { ProductionOrder } from './production-order.entity';

@Entity('production_order_materials')
@Index(['client_id', 'production_order_id'])
@Index(['client_id', 'item_id'])
export class ProductionOrderMaterial {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @ManyToOne(() => ProductionOrder, (order) => order.materials, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'production_order_id' })
  production_order: ProductionOrder;

  @Column({ name: 'production_order_id', type: 'int' })
  production_order_id: number;

  @ManyToOne(() => RecipeIngredient, { nullable: true })
  @JoinColumn({ name: 'recipe_ingredient_id' })
  recipe_ingredient: RecipeIngredient | null;

  @Column({ name: 'recipe_ingredient_id', type: 'int', nullable: true })
  recipe_ingredient_id: number | null;

  @ManyToOne(() => InventoryItem)
  @JoinColumn({ name: 'item_id' })
  item: InventoryItem;

  @Column({ name: 'item_id', type: 'int' })
  item_id: number;

  @Column({ name: 'uom', type: 'varchar', length: 50 })
  uom: string;

  @Column({
    name: 'wastage_percentage',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  wastage_percentage: number;

  @Column({
    name: 'planned_quantity',
    type: 'decimal',
    precision: 15,
    scale: 4,
    default: 0,
  })
  planned_quantity: number;

  @Column({
    name: 'issued_quantity',
    type: 'decimal',
    precision: 15,
    scale: 4,
    default: 0,
  })
  issued_quantity: number;

  @Column({
    name: 'unit_cost',
    type: 'decimal',
    precision: 15,
    scale: 4,
    default: 0,
  })
  unit_cost: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

