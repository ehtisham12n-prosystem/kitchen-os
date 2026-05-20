import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Client } from '../../platform/entities/client.entity';
import { Branch } from '../../setup/entities/branch.entity';

@Entity('pos_card_machines')
@Index(['client_id', 'branch_id', 'is_active'])
@Unique(['client_id', 'branch_id', 'machine_name'])
export class PosCardMachine {
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

  @Column({ name: 'machine_name', type: 'varchar', length: 120 })
  machine_name: string;

  @Column({ name: 'service_provider', type: 'varchar', length: 120 })
  service_provider: string;

  @Column({ name: 'pid_number', type: 'varchar', length: 80 })
  pid_number: string;

  @Column({ name: 'mid_number', type: 'varchar', length: 80 })
  mid_number: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

