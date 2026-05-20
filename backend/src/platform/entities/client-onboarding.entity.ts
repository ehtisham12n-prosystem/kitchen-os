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
import { Client } from './client.entity';
import { UserManagement } from '../../setup/entities/UserManagement.entity';

export const CLIENT_ONBOARDING_STATUSES = [
  'in_progress',
  'blocked',
  'failed',
  'ready_for_activation',
  'completed',
  'cancelled',
] as const;

export type ClientOnboardingStatus = (typeof CLIENT_ONBOARDING_STATUSES)[number];

@Entity('client_onboardings')
@Index(['client_id', 'created_at'])
export class ClientOnboarding {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @Column({
    name: 'onboarding_status',
    type: 'enum',
    enum: CLIENT_ONBOARDING_STATUSES,
    default: 'in_progress',
  })
  status: ClientOnboardingStatus;

  @Column({ name: 'current_stage', type: 'varchar', length: 100, nullable: true })
  current_stage: string | null;

  @Column({ name: 'started_by', type: 'varchar', length: 255, nullable: true })
  started_by: string | null;

  @Column({ name: 'started_at', type: 'datetime', nullable: true })
  started_at: Date | null;

  @ManyToOne(() => UserManagement, { nullable: true })
  @JoinColumn({ name: 'initial_admin_user_id' })
  initial_admin_user: UserManagement | null;

  @Column({ name: 'initial_admin_user_id', type: 'int', nullable: true })
  initial_admin_user_id: number | null;

  @Column({ name: 'failure_summary', type: 'text', nullable: true })
  failure_summary: string | null;

  @Column({ name: 'readiness_verified_by', type: 'varchar', length: 255, nullable: true })
  readiness_verified_by: string | null;

  @Column({ name: 'readiness_verified_at', type: 'datetime', nullable: true })
  readiness_verified_at: Date | null;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completed_at: Date | null;

  @Column({ name: 'cancelled_at', type: 'datetime', nullable: true })
  cancelled_at: Date | null;

  @Column({ name: 'last_evaluated_at', type: 'datetime', nullable: true })
  last_evaluated_at: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}

