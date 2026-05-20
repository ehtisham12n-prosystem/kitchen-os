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
  CATERING_INQUIRY_STATUSES,
  CATERING_SERVICE_TYPES,
  type CateringInquiryStatus,
  type CateringServiceType,
} from '../catering.constants';
import { CateringQuotation } from './catering-quotation.entity';
import { CateringEvent } from './catering-event.entity';

@Entity('catering_inquiries')
@Index(['client_id', 'inquiry_no'], { unique: true })
@Index(['client_id', 'branch_id'])
@Index(['client_id', 'status'])
@Index(['client_id', 'event_date'])
export class CateringInquiry {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ name: 'branch_id', type: 'int' })
  branch_id: number;

  @ManyToOne(() => Customer, { nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @Column({ name: 'customer_id', type: 'int', nullable: true })
  customer_id: number | null;

  @Column({ name: 'inquiry_no', type: 'varchar', length: 50 })
  inquiry_no: string;

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

  @Column({ name: 'contact_name', type: 'varchar', length: 150, nullable: true })
  contact_name: string | null;

  @Column({ name: 'contact_phone', type: 'varchar', length: 30, nullable: true })
  contact_phone: string | null;

  @Column({ name: 'contact_email', type: 'varchar', length: 150, nullable: true })
  contact_email: string | null;

  @Column({ name: 'budget_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  budget_amount: number | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: CATERING_INQUIRY_STATUSES,
    default: 'open',
  })
  status: CateringInquiryStatus;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'captured_by', type: 'varchar', length: 100, nullable: true })
  captured_by: string | null;

  @Column({ name: 'captured_by_name', type: 'varchar', length: 150, nullable: true })
  captured_by_name: string | null;

  @OneToMany(() => CateringQuotation, (quotation) => quotation.inquiry)
  quotations: CateringQuotation[];

  @OneToMany(() => CateringEvent, (event) => event.inquiry)
  events: CateringEvent[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

