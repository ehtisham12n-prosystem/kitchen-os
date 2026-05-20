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
import {
  CATERING_QUOTATION_STATUSES,
  type CateringQuotationStatus,
} from '../catering.constants';
import { CateringInquiry } from './catering-inquiry.entity';
import { CateringQuotationItem } from './catering-quotation-item.entity';
import { CateringEvent } from './catering-event.entity';

@Entity('catering_quotations')
@Index(['client_id', 'quote_no'], { unique: true })
@Index(['client_id', 'branch_id'])
@Index(['client_id', 'status'])
@Index(['client_id', 'inquiry_id'])
export class CateringQuotation {
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

  @ManyToOne(() => CateringInquiry)
  @JoinColumn({ name: 'inquiry_id' })
  inquiry: CateringInquiry;

  @Column({ name: 'inquiry_id', type: 'int' })
  inquiry_id: number;

  @Column({ name: 'quote_no', type: 'varchar', length: 50 })
  quote_no: string;

  @Column({ name: 'revision_no', type: 'int', default: 1 })
  revision_no: number;

  @Column({
    name: 'status',
    type: 'enum',
    enum: CATERING_QUOTATION_STATUSES,
    default: 'draft',
  })
  status: CateringQuotationStatus;

  @Column({ name: 'valid_until', type: 'date', nullable: true })
  valid_until: string | null;

  @Column({ name: 'subtotal_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal_amount: number;

  @Column({ name: 'estimated_cost_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  estimated_cost_amount: number;

  @Column({ name: 'service_charge_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  service_charge_amount: number;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  tax_amount: number;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  discount_amount: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  total_amount: number;

  @Column({ name: 'margin_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  margin_amount: number;

  @Column({ name: 'terms_and_conditions', type: 'text', nullable: true })
  terms_and_conditions: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'prepared_by', type: 'varchar', length: 100, nullable: true })
  prepared_by: string | null;

  @Column({ name: 'prepared_by_name', type: 'varchar', length: 150, nullable: true })
  prepared_by_name: string | null;

  @Column({ name: 'sent_at', type: 'datetime', nullable: true })
  sent_at: Date | null;

  @Column({ name: 'approved_at', type: 'datetime', nullable: true })
  approved_at: Date | null;

  @Column({ name: 'approved_by', type: 'varchar', length: 100, nullable: true })
  approved_by: string | null;

  @Column({ name: 'approved_by_name', type: 'varchar', length: 150, nullable: true })
  approved_by_name: string | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejection_reason: string | null;

  @OneToMany(() => CateringQuotationItem, (item) => item.quotation, { cascade: true })
  items: CateringQuotationItem[];

  @OneToMany(() => CateringEvent, (event) => event.quotation)
  events: CateringEvent[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

