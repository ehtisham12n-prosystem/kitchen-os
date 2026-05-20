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
import { Branch } from '../../setup/entities/branch.entity';

@Entity('pos_devices')
@Index(['client_id', 'branch_id'])
@Index(['client_id', 'device_uid'], { unique: true })
export class PosDevice {
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

  @Column({ name: 'device_uid', length: 100 })
  device_uid: string;

  @Column({ name: 'device_code', length: 50, nullable: true })
  device_code: string;

  @Column({ name: 'device_name', length: 100, nullable: true })
  device_name: string;

  @Column({
    name: 'device_type',
    type: 'enum',
    enum: ['pos_terminal', 'kds', 'order_taker', 'backoffice', 'other'],
    default: 'pos_terminal',
  })
  device_type: string;

  @Column({ name: 'device_os', length: 50, nullable: true })
  device_os: string;

  @Column({ name: 'app_version', length: 50, nullable: true })
  app_version: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ['active', 'inactive', 'blocked'],
    default: 'active',
  })
  status: string;

  @Column({ name: 'last_seen_at', type: 'datetime', nullable: true })
  last_seen_at: Date;

  @Column({ name: 'last_sync_at', type: 'datetime', nullable: true })
  last_sync_at: Date | null;

  @Column({
    name: 'last_sync_status',
    type: 'enum',
    enum: ['idle', 'success', 'failed', 'conflict'],
    default: 'idle',
  })
  last_sync_status: string;

  @Column({ name: 'last_sync_message', type: 'text', nullable: true })
  last_sync_message: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}

