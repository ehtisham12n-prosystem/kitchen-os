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
import { ClientOnboarding } from './client-onboarding.entity';

export const CLIENT_ONBOARDING_STEP_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'blocked',
  'failed',
  'skipped',
] as const;

export const CLIENT_ONBOARDING_STEP_TYPES = [
  'system',
  'manual',
  'action',
] as const;

export type ClientOnboardingStepStatus = (typeof CLIENT_ONBOARDING_STEP_STATUSES)[number];
export type ClientOnboardingStepType = (typeof CLIENT_ONBOARDING_STEP_TYPES)[number];

@Entity('client_onboarding_steps')
@Index(['onboarding_id', 'sort_order'])
@Index(['client_id', 'step_key'])
export class ClientOnboardingStep {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ClientOnboarding, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'onboarding_id' })
  onboarding: ClientOnboarding;

  @Column({ name: 'onboarding_id', type: 'int' })
  onboarding_id: number;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @Column({ name: 'step_key', length: 80 })
  step_key: string;

  @Column({ name: 'step_name', length: 150 })
  step_name: string;

  @Column({
    name: 'step_type',
    type: 'enum',
    enum: CLIENT_ONBOARDING_STEP_TYPES,
  })
  step_type: ClientOnboardingStepType;

  @Column({ name: 'is_required', default: true })
  is_required: boolean;

  @Column({
    name: 'step_status',
    type: 'enum',
    enum: CLIENT_ONBOARDING_STEP_STATUSES,
    default: 'pending',
  })
  status: ClientOnboardingStepStatus;

  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attempt_count: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  last_error: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'completed_by', type: 'varchar', length: 255, nullable: true })
  completed_by: string | null;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completed_at: Date | null;

  @Column({ name: 'sort_order', type: 'int', default: 1 })
  sort_order: number;

  @Column({ name: 'metadata_json', type: 'text', nullable: true })
  metadata_json: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
