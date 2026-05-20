import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  ClientSubscription,
} from './client-subscription.entity';
import { Client } from './client.entity';
import {
  CLIENT_SUBSCRIPTION_BILLING_CYCLES,
  CLIENT_SUBSCRIPTION_STATUSES,
} from './client-subscription.constants';
import type {
  ClientSubscriptionBillingCycle,
  ClientSubscriptionStatus,
} from './client-subscription.constants';

@Entity('client_subscription_history')
export class ClientSubscriptionHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @ManyToOne(() => ClientSubscription, (subscription) => subscription.history)
  @JoinColumn({ name: 'subscription_id' })
  subscription: ClientSubscription;

  @Column({ name: 'subscription_id', type: 'int' })
  subscription_id: number;

  @Column({ name: 'action_type', length: 50 })
  action_type: string;

  @Column({
    name: 'from_status',
    type: 'enum',
    enum: CLIENT_SUBSCRIPTION_STATUSES,
    nullable: true,
  })
  from_status: ClientSubscriptionStatus | null;

  @Column({
    name: 'to_status',
    type: 'enum',
    enum: CLIENT_SUBSCRIPTION_STATUSES,
    nullable: true,
  })
  to_status: ClientSubscriptionStatus | null;

  @Column({ name: 'from_plan_id', type: 'int', nullable: true })
  from_plan_id: number | null;

  @Column({ name: 'to_plan_id', type: 'int', nullable: true })
  to_plan_id: number | null;

  @Column({ name: 'from_plan_name', type: 'varchar', length: 150, nullable: true })
  from_plan_name: string | null;

  @Column({ name: 'to_plan_name', type: 'varchar', length: 150, nullable: true })
  to_plan_name: string | null;

  @Column({
    name: 'billing_cycle',
    type: 'enum',
    enum: CLIENT_SUBSCRIPTION_BILLING_CYCLES,
    nullable: true,
  })
  billing_cycle: ClientSubscriptionBillingCycle | null;

  @Column({
    name: 'price_snapshot',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  price_snapshot: number | null;

  @Column({ name: 'reason', type: 'varchar', length: 255, nullable: true })
  reason: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'changed_by', type: 'varchar', length: 255, nullable: true })
  changed_by: string | null;

  @CreateDateColumn()
  created_at: Date;
}

