import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ClientSubscription } from './client-subscription.entity';

export const SUBSCRIPTION_PLAN_STATUSES = [
  'draft',
  'active',
  'retired',
] as const;

export type SubscriptionPlanStatus = (typeof SUBSCRIPTION_PLAN_STATUSES)[number];

@Entity('subscription_plans')
export class SubscriptionPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'plan_code', length: 50, unique: true })
  plan_code: string;

  @Column({ name: 'plan_name' })
  plan_name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    name: 'plan_status',
    type: 'enum',
    enum: SUBSCRIPTION_PLAN_STATUSES,
    default: 'draft',
  })
  plan_status: SubscriptionPlanStatus;

  @Column({ name: 'is_active', default: true })
  is_active: boolean;

  @Column({ name: 'currency_code', length: 10, default: 'PKR' })
  currency_code: string;

  @Column({ name: 'trial_enabled', default: false })
  trial_enabled: boolean;

  @Column({ name: 'default_trial_days', type: 'int', default: 0 })
  default_trial_days: number;

  @Column({ name: 'plan_max_branches', type: 'int', default: 1 })
  max_branches: number;

  @Column({ name: 'plan_max_users', type: 'int', default: 5 })
  max_users: number;

  @Column({ name: 'plan_max_pos_devices', type: 'int', default: 1 })
  max_pos_devices: number;

  @Column({ type: 'json' })
  allowed_modules: string[];

  @Column({
    name: 'plan_monthly_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  monthly_price: number;

  @Column({
    name: 'plan_annual_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  annual_price: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => ClientSubscription, (subscription) => subscription.plan)
  subscriptions: ClientSubscription[];
}
