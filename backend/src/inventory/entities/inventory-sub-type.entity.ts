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
import { InventoryType } from './inventory-type.entity';

@Entity('inventory_sub_types')
@Index(['client_id', 'type_id'])
@Index(['client_id', 'is_active'])
export class InventorySubType {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @ManyToOne(() => InventoryType)
  @JoinColumn({ name: 'type_id' })
  inventoryType: InventoryType;

  @Column({ name: 'type_id' })
  type_id: number;

  @Column({ name: 'sub_type_name', length: 150 })
  sub_type_name: string; // e.g., "Chicken"

  @Column({ name: 'affects_stock', type: 'boolean', default: true })
  affects_stock: boolean;

  @Column({ name: 'affects_recipe', type: 'boolean', default: false })
  affects_recipe: boolean;

  @Column({ name: 'depreciable', type: 'boolean', default: false })
  depreciable: boolean;

  @Column({ name: 'track_expiry', type: 'boolean', default: false })
  track_expiry: boolean;

  @Column({ name: 'track_batch', type: 'boolean', default: false })
  track_batch: boolean;

  @Column({ name: 'allow_issuance', type: 'boolean', default: true })
  allow_issuance: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

