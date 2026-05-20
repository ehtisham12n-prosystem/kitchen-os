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
import { Branch } from './branch.entity';

@Entity('branch_charges')
@Index(['client_id', 'branch_id'])
export class BranchCharge {
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

  @Column({ length: 100 })
  name: string;

  @Column({
    type: 'enum',
    enum: ['percentage', 'fixed'],
    default: 'percentage',
  })
  type: string;

  @Column({ name: 'is_tax', type: 'boolean', default: true })
  is_tax: boolean;

  @Column({
    name: 'condition_trigger',
    type: 'enum',
    enum: ['none', 'payment_method', 'order_type'],
    default: 'none',
  })
  condition_trigger: string;

  @Column({ type: 'json', nullable: true })
  rate_map: any; // e.g., {"cash": 15, "card": 5} or {"default": 50}

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

