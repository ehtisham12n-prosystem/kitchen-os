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
import { PosDevice } from './pos-device.entity';

@Entity('pos_sync_events')
@Index(['client_id', 'branch_id'])
@Index(['device_id', 'status'])
@Index(['entity_type', 'entity_id'])
@Index(['device_id', 'device_event_id'], { unique: true })
export class PosSyncEvent {
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

  @ManyToOne(() => PosDevice, { nullable: true })
  @JoinColumn({ name: 'device_id' })
  device: PosDevice;

  @Column({ name: 'device_id', nullable: true })
  device_id: number;

  @Column({ name: 'device_event_id', length: 100, nullable: true })
  device_event_id: string;

  @Column({ name: 'entity_type', length: 50 })
  entity_type: string;

  @Column({ name: 'entity_id', length: 64, nullable: true })
  entity_id: string;

  @Column({
    name: 'event_type',
    type: 'enum',
    enum: ['upsert', 'delete', 'sync'],
    default: 'upsert',
  })
  event_type: string;

  @Column({ name: 'payload_hash', length: 64 })
  payload_hash: string;

  @Column({ name: 'batch_id', type: 'varchar', length: 100, nullable: true })
  batch_id: string | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ['pending', 'processed', 'failed', 'conflict'],
    default: 'pending',
  })
  status: string;

  @Column({ name: 'payload_json', type: 'longtext', nullable: true })
  payload_json: string;

  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attempt_count: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  error_message: string;

  @Column({ name: 'conflict_reason', type: 'varchar', length: 100, nullable: true })
  conflict_reason: string | null;

  @Column({
    name: 'resolution_status',
    type: 'enum',
    enum: ['open', 'acknowledged', 'resolved'],
    nullable: true,
  })
  resolution_status: string | null;

  @Column({ name: 'resolution_note', type: 'text', nullable: true })
  resolution_note: string | null;

  @Column({ name: 'occurred_at', type: 'datetime', nullable: true })
  occurred_at: Date | null;

  @Column({ name: 'last_attempt_at', type: 'datetime', nullable: true })
  last_attempt_at: Date;

  @Column({ name: 'processed_at', type: 'datetime', nullable: true })
  processed_at: Date;

  @Column({ name: 'resolved_at', type: 'datetime', nullable: true })
  resolved_at: Date | null;

  @Column({ name: 'resolved_by_user_id', type: 'int', nullable: true })
  resolved_by_user_id: number | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}

