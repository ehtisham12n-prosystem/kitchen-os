import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Client } from '../../platform/entities/client.entity';
import { Branch } from '../../setup/entities/branch.entity';
import { Customer } from '../../customers/entities/customer.entity';
import {
  CATERING_BILLING_STATUSES,
  CATERING_EVENT_STATUSES,
  CATERING_SERVICE_TYPES,
  type CateringBillingStatus,
  type CateringEventStatus,
  type CateringServiceType,
} from '../catering.constants';
import { CateringInquiry } from './catering-inquiry.entity';
import { CateringQuotation } from './catering-quotation.entity';
import { CateringEventItem } from './catering-event-item.entity';
import { CateringEventProcurementLink } from './catering-event-procurement-link.entity';
import { CateringEventProductionLink } from './catering-event-production-link.entity';
import { CateringEventSettlement } from './catering-event-settlement.entity';
import { CateringEventBilling } from './catering-event-billing.entity';

@Entity('catering_events')
@Index(['client_id', 'event_no'], { unique: true })
@Index(['client_id', 'event_date'])
@Index(['client_id', 'status'])
@Index(['client_id', 'execution_branch_id'])
export class CateringEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @ManyToOne(() => CateringInquiry)
  @JoinColumn({ name: 'inquiry_id' })
  inquiry: CateringInquiry;

  @Column({ name: 'inquiry_id', type: 'int' })
  inquiry_id: number;

  @ManyToOne(() => CateringQuotation)
  @JoinColumn({ name: 'quotation_id' })
  quotation: CateringQuotation;

  @Column({ name: 'quotation_id', type: 'int' })
  quotation_id: number;

  @ManyToOne(() => Customer, { nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @Column({ name: 'customer_id', type: 'int', nullable: true })
  customer_id: number | null;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'execution_branch_id' })
  execution_branch: Branch;

  @Column({ name: 'execution_branch_id', type: 'int' })
  execution_branch_id: number;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'production_branch_id' })
  production_branch: Branch | null;

  @Column({ name: 'production_branch_id', type: 'int', nullable: true })
  production_branch_id: number | null;

  @Column({ name: 'event_no', type: 'varchar', length: 50 })
  event_no: string;

  @Column({ name: 'event_title', type: 'varchar', length: 150 })
  event_title: string;

  @Column({
    name: 'service_type',
    type: 'enum',
    enum: CATERING_SERVICE_TYPES,
    default: 'offsite',
  })
  service_type: CateringServiceType;

  @Column({ name: 'event_date', type: 'date' })
  event_date: string;

  @Column({ name: 'start_time', type: 'varchar', length: 5, nullable: true })
  start_time: string | null;

  @Column({ name: 'end_time', type: 'varchar', length: 5, nullable: true })
  end_time: string | null;

  @Column({ name: 'guest_count', type: 'int', default: 1 })
  guest_count: number;

  @Column({ name: 'venue_name', type: 'varchar', length: 150, nullable: true })
  venue_name: string | null;

  @Column({ name: 'venue_address', type: 'text', nullable: true })
  venue_address: string | null;

  @Column({ name: 'coordinator_name', type: 'varchar', length: 150, nullable: true })
  coordinator_name: string | null;

  @Column({ name: 'coordinator_phone', type: 'varchar', length: 30, nullable: true })
  coordinator_phone: string | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: CATERING_EVENT_STATUSES,
    default: 'planned',
  })
  status: CateringEventStatus;

  @Column({
    name: 'billing_status',
    type: 'enum',
    enum: CATERING_BILLING_STATUSES,
    default: 'unbilled',
  })
  billing_status: CateringBillingStatus;

  @Column({ name: 'quoted_total_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  quoted_total_amount: number;

  @Column({ name: 'estimated_cost_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  estimated_cost_amount: number;

  @Column({ name: 'actual_total_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  actual_total_amount: number | null;

  @Column({ name: 'total_paid_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  total_paid_amount: number;

  @Column({ name: 'billing_journal_entry_id', type: 'int', nullable: true })
  billing_journal_entry_id: number | null;

  @Column({ name: 'billing_issued_at', type: 'datetime', nullable: true })
  billing_issued_at: Date | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'confirmed_at', type: 'datetime', nullable: true })
  confirmed_at: Date | null;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completed_at: Date | null;

  @OneToMany(() => CateringEventItem, (item) => item.event, { cascade: true })
  items: CateringEventItem[];

  @OneToMany(() => CateringEventProcurementLink, (link) => link.event)
  procurement_links: CateringEventProcurementLink[];

  @OneToMany(() => CateringEventProductionLink, (link) => link.event)
  production_links: CateringEventProductionLink[];

  @OneToMany(() => CateringEventSettlement, (settlement) => settlement.event)
  settlements: CateringEventSettlement[];

  @OneToMany(() => CateringEventBilling, (billing) => billing.event)
  billings: CateringEventBilling[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

