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
import { InventoryClass } from './inventory-class.entity';

@Entity('inventory_types')
@Index(['client_id', 'class_id'])
@Index(['client_id', 'is_active'])
export class InventoryType {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @ManyToOne(() => InventoryClass)
  @JoinColumn({ name: 'class_id' })
  inventoryClass: InventoryClass;

  @Column({ name: 'class_id' })
  class_id: number;

  @Column({ name: 'type_name', length: 150 })
  type_name: string; // e.g., "Meat"

  @Column({ name: 'is_active', type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

