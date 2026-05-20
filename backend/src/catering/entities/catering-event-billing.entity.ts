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
import { Client } from '../../platform/entities/client.entity';
import { Branch } from '../../setup/entities/branch.entity';
import {
  CATERING_BILLING_STATUSES,
  CATERING_EVENT_BILLING_TYPES,
  type CateringBillingStatus,
  type CateringEventBillingType,
} from '../catering.constants';
import { CateringEvent } from './catering-event.entity';

@Entity('catering_event_billings')
@Index(['client_id', 'event_id'])
@Index(['client_id', 'branch_id'])
@Index(['client_id', 'billing_date'])
export class CateringEventBilling {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @ManyToOne(() => CateringEvent, (event) => event.billings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: CateringEvent;

  @Column({ name: 'event_id', type: 'int' })
  event_id: number;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ name: 'branch_id', type: 'int' })
  branch_id: number;

  @Column({
    name: 'billing_type',
    type: 'enum',
    enum: CATERING_EVENT_BILLING_TYPES,
    default: 'milestone',
  })
  billing_type: CateringEventBillingType;

  @Column({ name: 'label', type: 'varchar', length: 150, nullable: true })
  label: string | null;

  @Column({ name: 'billing_date', type: 'date' })
  billing_date: string;

  @Column({ name: 'amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  amount: number;

  @Column({ name: 'applied_advance_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  applied_advance_amount: number;

  @Column({
    name: 'status',
    type: 'enum',
    enum: CATERING_BILLING_STATUSES,
    default: 'billed',
  })
  status: CateringBillingStatus;

  @Column({ name: 'accounting_journal_entry_id', type: 'int', nullable: true })
  accounting_journal_entry_id: number | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'issued_at', type: 'datetime', nullable: true })
  issued_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
