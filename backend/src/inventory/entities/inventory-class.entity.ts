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

@Entity('inventory_classes')
@Index(['client_id']) // Used to quickly fetch all high-level classes for a client
@Index(['client_id', 'is_active'])
export class InventoryClass {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @Column({ name: 'class_name', length: 150 })
  class_name: string; // e.g. "Raw Materials", "MRO"

  @Column({ name: 'class_description', type: 'text', nullable: true })
  class_description: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

