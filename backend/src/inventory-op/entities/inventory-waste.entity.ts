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
import { Client } from '../../platform/entities/client.entity';
import { Branch } from '../../setup/entities/branch.entity';
import { InventoryWasteLine } from './inventory-waste-line.entity';

@Entity('inventory_waste')
@Index(['client_id', 'branch_id', 'waste_date'])
export class InventoryWaste {
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

  @Column({ name: 'waste_date', type: 'datetime' })
  waste_date: Date;

  @Column({ name: 'waste_type', type: 'varchar', length: 50 })
  waste_type: string;

  @Column({ name: 'reason', type: 'varchar', length: 255, nullable: true })
  reason: string | null;

  @Column({ name: 'approved_by', type: 'varchar', length: 120, nullable: true })
  approved_by: string | null;

  @Column({ name: 'total_cost', type: 'decimal', precision: 15, scale: 4, default: 0 })
  total_cost: number;

  @OneToMany(() => InventoryWasteLine, (line) => line.waste)
  lines: InventoryWasteLine[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
