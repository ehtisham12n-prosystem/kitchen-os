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
import { CLIENT_GOVERNANCE_CONTEXTS, CLIENT_GOVERNANCE_STATES } from './client.constants';

@Entity('client_governance_history')
@Index(['client_id', 'created_at'])
export class ClientGovernanceHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client, (client) => client.governance_history, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @Column({ name: 'action_type', length: 80 })
  action_type: string;

  @Column({
    name: 'from_state',
    type: 'enum',
    enum: CLIENT_GOVERNANCE_STATES,
    nullable: true,
  })
  from_state: string | null;

  @Column({
    name: 'to_state',
    type: 'enum',
    enum: CLIENT_GOVERNANCE_STATES,
  })
  to_state: string;

  @Column({
    name: 'trigger_context',
    type: 'enum',
    enum: CLIENT_GOVERNANCE_CONTEXTS,
  })
  trigger_context: string;

  @Column({ name: 'reason', length: 255 })
  reason: string;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'changed_by', type: 'varchar', length: 255, nullable: true })
  changed_by: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}

