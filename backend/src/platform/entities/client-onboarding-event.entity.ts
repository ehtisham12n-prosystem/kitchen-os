import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ClientOnboarding } from './client-onboarding.entity';

@Entity('client_onboarding_events')
@Index(['onboarding_id', 'created_at'])
@Index(['client_id', 'created_at'])
export class ClientOnboardingEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ClientOnboarding, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'onboarding_id' })
  onboarding: ClientOnboarding;

  @Column({ name: 'onboarding_id', type: 'int' })
  onboarding_id: number;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @Column({ name: 'event_type', length: 80 })
  event_type: string;

  @Column({ name: 'step_key', type: 'varchar', length: 80, nullable: true })
  step_key: string | null;

  @Column({ name: 'message', length: 255 })
  message: string;

  @Column({ name: 'details_json', type: 'text', nullable: true })
  details_json: string | null;

  @Column({ name: 'created_by', type: 'varchar', length: 255, nullable: true })
  created_by: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
