import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Branch } from '../../setup/entities/branch.entity';
import { Client } from '../../platform/entities/client.entity';
import { InventoryConsumptionLine } from './inventory-consumption-line.entity';

@Entity('inventory_consumptions')
@Index(['client_id', 'branch_id', 'source_type', 'source_id'])
export class InventoryConsumption {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ name: 'branch_id' })
  branch_id: number;

  @Column({ name: 'source_type', type: 'varchar', length: 50 })
  source_type: string;

  @Column({ name: 'source_id', type: 'varchar', length: 100 })
  source_id: string;

  @Column({ name: 'posted_by', type: 'varchar', length: 120, nullable: true })
  posted_by: string | null;

  @Column({ name: 'posted_at', type: 'datetime' })
  posted_at: Date;

  @Column({ name: 'total_cost', type: 'decimal', precision: 15, scale: 4, default: 0 })
  total_cost: number;

  @Column({ name: 'metadata', type: 'json', nullable: true })
  metadata: Record<string, unknown> | null;

  @OneToMany(() => InventoryConsumptionLine, (line) => line.consumption)
  lines: InventoryConsumptionLine[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
