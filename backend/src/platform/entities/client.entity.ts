import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { SubscriptionPlan } from './subscription-plan.entity';
import { ClientSettings } from './client-settings.entity';
import { Branch } from '../../setup/entities/branch.entity';
import { ClientContact } from './client-contact.entity';
import { ClientStatusHistory } from './client-status-history.entity';
import { ClientSubscription } from './client-subscription.entity';
import { ClientGovernanceHistory } from './client-governance-history.entity';
import {
  CLIENT_GOVERNANCE_CONTEXTS,
  CLIENT_GOVERNANCE_STATES,
  CLIENT_LIFECYCLE_STATES,
} from './client.constants';
export {
  CLIENT_GOVERNANCE_CONTEXTS,
  CLIENT_GOVERNANCE_STATES,
  CLIENT_LIFECYCLE_STATES,
} from './client.constants';
export type {
  ClientGovernanceContext,
  ClientGovernanceState,
  ClientLifecycleState,
} from './client.constants';

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'client_code', type: 'varchar', unique: true, length: 30 })
  client_code: string;

  @Column({ name: 'legal_name', type: 'varchar', length: 150, nullable: true })
  legal_name: string | null;

  @Column({ name: 'client_name', length: 150 })
  client_name: string;

  @Column({ name: 'client_domain_slug', unique: true, length: 100 })
  domain_slug: string;

  @Column({
    name: 'client_status',
    type: 'enum',
    enum: CLIENT_LIFECYCLE_STATES,
    default: 'draft',
  })
  status: string;

  @Column({
    name: 'governance_state',
    type: 'enum',
    enum: CLIENT_GOVERNANCE_STATES,
    default: 'normal',
  })
  governance_state: string;

  @Column({
    name: 'governance_context',
    type: 'enum',
    enum: CLIENT_GOVERNANCE_CONTEXTS,
    nullable: true,
  })
  governance_context: string | null;

  @Column({ name: 'governance_reason', type: 'varchar', length: 255, nullable: true })
  governance_reason: string | null;

  @Column({ name: 'governance_notes', type: 'text', nullable: true })
  governance_notes: string | null;

  @Column({ name: 'governance_updated_at', type: 'datetime', nullable: true })
  governance_updated_at: Date | null;

  @Column({ name: 'governance_updated_by', type: 'varchar', length: 255, nullable: true })
  governance_updated_by: string | null;

  @ManyToOne(() => SubscriptionPlan)
  @JoinColumn({ name: 'subscription_plan_id' })
  subscription_plan: SubscriptionPlan;

  @Column({ name: 'subscription_plan_id', nullable: true })
  subscription_plan_id: number;

  @Column({ type: 'datetime', nullable: true })
  expiry_date: Date;

  @Column({ type: 'int', default: 0 })
  grace_period_days: number;

  @Column({ name: 'short_name', type: 'varchar', length: 50, nullable: true })
  short_name: string;

  @Column({ name: 'business_type', length: 50, default: 'restaurant' })
  business_type: string;

  @Column({ name: 'address', type: 'text', nullable: true })
  address: string;

  @Column({ name: 'area', type: 'varchar', length: 100, nullable: true })
  area: string;

  @Column({ name: 'city', type: 'varchar', length: 100, nullable: true })
  city: string;

  @Column({ name: 'country', type: 'varchar', length: 100, nullable: true })
  country: string;

  @Column({ name: 'phone', type: 'varchar', length: 20, nullable: true })
  phone: string;

  @Column({ name: 'email', type: 'varchar', length: 100, nullable: true })
  email: string;

  @Column({ name: 'cell_phone', type: 'varchar', length: 20, nullable: true })
  cell_phone: string;

  @Column({ name: 'website_url', type: 'varchar', length: 255, nullable: true })
  website_url: string;

  @Column({ name: 'language', length: 10, default: 'en' })
  language: string;

  @Column({ name: 'currency', length: 10, default: 'USD' })
  currency: string;

  @Column({ name: 'timezone', length: 100, default: 'UTC' })
  timezone: string;

  @Column({ name: 'poc_full_name', type: 'varchar', length: 150, nullable: true })
  poc_full_name: string;

  @Column({ name: 'poc_designation', type: 'varchar', length: 100, nullable: true })
  poc_designation: string;

  @Column({ name: 'poc_phone', type: 'varchar', length: 20, nullable: true })
  poc_phone: string;

  @Column({ name: 'poc_cell_phone', type: 'varchar', length: 20, nullable: true })
  poc_cell_phone: string;

  @Column({ name: 'poc_email', type: 'varchar', length: 100, nullable: true })
  poc_email: string;

  @Column({ name: 'comments', type: 'text', nullable: true })
  comments: string;

  @Column({ name: 'theme_id', type: 'int', nullable: true })
  theme_id: number;

  @Column({ name: 'subscription_type', type: 'enum', enum: ['monthly', 'annual'], default: 'monthly' })
  subscription_type: string;

  @Column({ name: 'renewal_day', type: 'int', nullable: true })
  renewal_day: number;

  @Column({ name: 'renewal_date', type: 'varchar', length: 10, nullable: true })
  renewal_date: string;

  @Column({ type: 'datetime', nullable: true })
  subscription_start: Date;

  @Column({ type: 'datetime', nullable: true })
  subscription_end: Date;

  @Column({ name: 'enabled_modules', type: 'text', nullable: true })
  enabled_modules_json: string; // JSON string of modules

  @Column({ name: 'onboarding_blueprint', type: 'varchar', length: 50, nullable: true })
  onboarding_blueprint: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ name: 'created_by', nullable: true })
  created_by: number;

  @Column({ name: 'updated_by', nullable: true })
  updated_by: number;

  @Column({ name: 'max_branches', type: 'int', default: 1 })
  max_branches: number;

  @Column({ name: 'max_users', type: 'int', default: 5 })
  max_users: number;

  @OneToOne(() => ClientSettings, (settings) => settings.client)
  settings: ClientSettings;

  @OneToMany(() => Branch, (branch) => branch.client)
  branches: Branch[];

  @OneToMany(() => ClientContact, (contact) => contact.client)
  contacts: ClientContact[];

  @OneToMany(() => ClientStatusHistory, (history) => history.client)
  status_history: ClientStatusHistory[];

  @OneToMany(() => ClientSubscription, (subscription) => subscription.client)
  subscriptions: ClientSubscription[];

  @OneToMany(() => ClientGovernanceHistory, (history) => history.client)
  governance_history: ClientGovernanceHistory[];

  get enabled_modules(): string[] {
    return this.enabled_modules_json ? JSON.parse(this.enabled_modules_json) : [];
  }

  set enabled_modules(val: string[]) {
    this.enabled_modules_json = JSON.stringify(val);
  }
}
