import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Client } from './client.entity';

export const CLIENT_LIMIT_KEYS = [
  'max_branches',
  'max_active_users',
  'max_pos_devices',
] as const;

export type ClientLimitKey = (typeof CLIENT_LIMIT_KEYS)[number];

@Entity('client_limit_overrides')
@Unique('ux_client_limit_overrides_client_limit', ['client_id', 'limit_key'])
export class ClientLimitOverride {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @Column({
    name: 'limit_key',
    type: 'enum',
    enum: CLIENT_LIMIT_KEYS,
  })
  limit_key: ClientLimitKey;

  @Column({ name: 'limit_value', type: 'int' })
  limit_value: number;

  @Column({ name: 'reason', length: 255 })
  reason: string;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'created_by', type: 'varchar', length: 255, nullable: true })
  created_by: string | null;

  @Column({ name: 'updated_by', type: 'varchar', length: 255, nullable: true })
  updated_by: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

