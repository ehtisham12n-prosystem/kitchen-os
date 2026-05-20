import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Client } from './client.entity';
import { CLIENT_LIFECYCLE_STATES } from './client.constants';

@Entity('client_status_history')
@Index(['client_id', 'created_at'])
export class ClientStatusHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client, (client) => client.status_history, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @Column({
    name: 'from_status',
    type: 'enum',
    enum: CLIENT_LIFECYCLE_STATES,
    nullable: true,
  })
  from_status: string | null;

  @Column({
    name: 'to_status',
    type: 'enum',
    enum: CLIENT_LIFECYCLE_STATES,
  })
  to_status: string;

  @Column({ name: 'reason', length: 255 })
  reason: string;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'changed_by', type: 'varchar', length: 255, nullable: true })
  changed_by: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}

