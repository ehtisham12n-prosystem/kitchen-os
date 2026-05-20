import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Client } from '../../platform/entities/client.entity';
import {
  CATERING_PAYMENT_MODES,
  CATERING_SETTLEMENT_TYPES,
  type CateringPaymentMode,
  type CateringSettlementType,
} from '../catering.constants';
import { CateringEvent } from './catering-event.entity';

@Entity('catering_event_settlements')
@Index(['client_id', 'event_id'])
@Index(['client_id', 'accounting_journal_entry_id'])
export class CateringEventSettlement {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @ManyToOne(() => CateringEvent, (event) => event.settlements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: CateringEvent;

  @Column({ name: 'event_id', type: 'int' })
  event_id: number;

  @Column({ name: 'branch_id', type: 'int' })
  branch_id: number;

  @Column({ name: 'payment_date', type: 'date' })
  payment_date: string;

  @Column({
    name: 'payment_mode',
    type: 'enum',
    enum: CATERING_PAYMENT_MODES,
    default: 'cash',
  })
  payment_mode: CateringPaymentMode;

  @Column({
    name: 'settlement_type',
    type: 'enum',
    enum: CATERING_SETTLEMENT_TYPES,
    default: 'collection',
  })
  settlement_type: CateringSettlementType;

  @Column({ name: 'amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  amount: number;

  @Column({ name: 'reference_no', type: 'varchar', length: 100, nullable: true })
  reference_no: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'accounting_journal_entry_id', type: 'int', nullable: true })
  accounting_journal_entry_id: number | null;

  @Column({ name: 'recorded_by', type: 'varchar', length: 100, nullable: true })
  recorded_by: string | null;

  @Column({ name: 'recorded_by_name', type: 'varchar', length: 150, nullable: true })
  recorded_by_name: string | null;

  @CreateDateColumn()
  created_at: Date;
}

