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
import { Branch } from './branch.entity';
import { Client } from '../../platform/entities/client.entity';

@Entity('branch_locations')
@Index(['client_id', 'branch_id', 'location_name'], { unique: true })
export class BranchLocation {
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

  @Column({ name: 'branch_id', type: 'int' })
  branch_id: number;

  @Column({ name: 'location_name', type: 'varchar', length: 120 })
  location_name: string;

  @Column({ name: 'location_code', type: 'varchar', length: 40, nullable: true })
  location_code: string | null;

  @Column({ name: 'location_type', type: 'varchar', length: 40, default: 'store' })
  location_type: string;

  @Column({ name: 'description', type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
