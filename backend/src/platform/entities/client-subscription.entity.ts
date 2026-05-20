import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Client } from './client.entity';
import { SubscriptionPlan } from './subscription-plan.entity';
import { ClientSubscriptionHistory } from './client-subscription-history.entity';
import {
  CLIENT_SUBSCRIPTION_BILLING_CYCLES,
  CLIENT_SUBSCRIPTION_STATUSES,
} from './client-subscription.constants';
import type {
  ClientSubscriptionBillingCycle,
  ClientSubscriptionStatus,
} from './client-subscription.constants';

@Entity('client_subscriptions')
export class ClientSubscription {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @ManyToOne(() => SubscriptionPlan, (plan) => plan.subscriptions)
  @JoinColumn({ name: 'plan_id' })
  plan: SubscriptionPlan;

  @Column({ name: 'plan_id', type: 'int' })
  plan_id: number;

  @Column({ name: 'plan_code_snapshot', length: 50 })
  plan_code_snapshot: string;

  @Column({ name: 'plan_name_snapshot', length: 150 })
  plan_name_snapshot: string;

  @Column({ name: 'plan_description_snapshot', type: 'text', nullable: true })
  plan_description_snapshot: string | null;

  @Column({ name: 'currency_code_snapshot', type: 'varchar', length: 10, nullable: true })
  currency_code_snapshot: string | null;

  @Column({
    name: 'billing_cycle',
    type: 'enum',
    enum: CLIENT_SUBSCRIPTION_BILLING_CYCLES,
    default: 'monthly',
  })
  billing_cycle: ClientSubscriptionBillingCycle;

  @Column({
    name: 'subscription_status',
    type: 'enum',
    enum: CLIENT_SUBSCRIPTION_STATUSES,
    default: 'pending',
  })
  status: ClientSubscriptionStatus;

  @Column({ name: 'is_trial', default: false })
  is_trial: boolean;

  @Column({ name: 'trial_start_at', type: 'datetime', nullable: true })
  trial_start_at: Date | null;

  @Column({ name: 'trial_end_at', type: 'datetime', nullable: true })
  trial_end_at: Date | null;

  @Column({ name: 'effective_start_at', type: 'datetime', nullable: true })
  effective_start_at: Date | null;

  @Column({ name: 'effective_end_at', type: 'datetime', nullable: true })
  effective_end_at: Date | null;

  @Column({ name: 'grace_start_at', type: 'datetime', nullable: true })
  grace_start_at: Date | null;

  @Column({ name: 'grace_end_at', type: 'datetime', nullable: true })
  grace_end_at: Date | null;

  @Column({ name: 'activated_at', type: 'datetime', nullable: true })
  activated_at: Date | null;

  @Column({ name: 'expired_at', type: 'datetime', nullable: true })
  expired_at: Date | null;

  @Column({ name: 'suspended_at', type: 'datetime', nullable: true })
  suspended_at: Date | null;

  @Column({ name: 'cancelled_at', type: 'datetime', nullable: true })
  cancelled_at: Date | null;

  @Column({
    name: 'price_snapshot',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  price_snapshot: number;

  @Column({ name: 'assignment_reason', type: 'varchar', length: 255, nullable: true })
  assignment_reason: string | null;

  @Column({ name: 'assignment_notes', type: 'text', nullable: true })
  assignment_notes: string | null;

  @Column({ name: 'created_by', type: 'varchar', length: 255, nullable: true })
  created_by: string | null;

  @Column({ name: 'updated_by', type: 'varchar', length: 255, nullable: true })
  updated_by: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => ClientSubscriptionHistory, (history) => history.subscription)
  history: ClientSubscriptionHistory[];
}

