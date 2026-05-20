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
import { Client } from '../../platform/entities/client.entity';
import { InventorySubType } from './inventory-sub-type.entity';

@Entity('inventory_items')
@Index(['client_id', 'sub_type_id'])
@Index(['client_id', 'item_is_active', 'item_name'])
@Index(['client_id', 'item_sku'])
export class InventoryItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @ManyToOne(() => InventorySubType)
  @JoinColumn({ name: 'sub_type_id' })
  subType: InventorySubType;

  @Column({ name: 'sub_type_id' })
  sub_type_id: number; // Links UP to Level 2 ("Chicken")

  @Column({ name: 'item_name', length: 150 })
  item_name: string; // e.g., "Whole Chicken"

  @Column({ name: 'item_name_other_language', type: 'varchar', length: 150, nullable: true })
  item_name_other_language: string | null;

  @Column({ name: 'item_sku', length: 100, nullable: true })
  item_sku: string;

  @Column({ name: 'uom_base', length: 50 })
  uom_base: string; // Base Unit of Measurement (e.g., "kg", "grams", "pieces")

  @Column({ name: 'uom_purchase', length: 50, nullable: true })
  uom_purchase: string; // How it's bought from supplier (e.g., "Box of 10Kg")

  @Column({ name: 'item_tag', length: 50, default: 'Raw Material' })
  item_tag: string;

  @Column({ name: 'item_is_active', type: 'boolean', default: true })
  item_is_active: boolean; // Global toggle.

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

