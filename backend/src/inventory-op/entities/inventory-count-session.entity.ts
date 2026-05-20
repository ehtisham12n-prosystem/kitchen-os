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
import { Branch } from '../../setup/entities/branch.entity';
import { Client } from '../../platform/entities/client.entity';
import { BranchLocation } from '../../setup/entities/branch-location.entity';
import { InventoryCountSessionItem } from './inventory-count-session-item.entity';

export const INVENTORY_COUNT_TYPES = [
  'random_cycle',
  'eod_blind_close',
  'monthly_full',
] as const;

export const INVENTORY_COUNT_STATUSES = [
  'scheduled',
  'in_progress',
  'submitted',
  'under_review',
  'reconciled',
  'adjustment_pending',
  'escalated',
  'closed',
  'cancelled',
] as const;

@Entity('inventory_count_sessions')
@Index(['client_id', 'branch_id', 'count_type', 'business_date'])
@Index(['client_id', 'branch_id', 'status'])
export class InventoryCountSession {
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

  @ManyToOne(() => BranchLocation, { nullable: true })
  @JoinColumn({ name: 'location_id' })
  location: BranchLocation | null;

  @Column({ name: 'location_id', type: 'int', nullable: true })
  location_id: number | null;

  @Column({ name: 'session_code', type: 'varchar', length: 40, unique: true })
  session_code: string;

  @Column({ name: 'title', type: 'varchar', length: 180 })
  title: string;

  @Column({
    name: 'count_type',
    type: 'enum',
    enum: INVENTORY_COUNT_TYPES,
  })
  count_type: (typeof INVENTORY_COUNT_TYPES)[number];

  @Column({
    name: 'status',
    type: 'enum',
    enum: INVENTORY_COUNT_STATUSES,
    default: 'scheduled',
  })
  status: (typeof INVENTORY_COUNT_STATUSES)[number];

  @Column({ name: 'business_date', type: 'date', nullable: true })
  business_date: string | null;

  @Column({ name: 'period_key', type: 'varchar', length: 7, nullable: true })
  period_key: string | null;

  @Column({ name: 'selection_summary', type: 'json', nullable: true })
  selection_summary: Record<string, unknown> | null;

  @Column({ name: 'thresholds', type: 'json', nullable: true })
  thresholds: Record<string, unknown> | null;

  @Column({ name: 'generated_by_user_id', type: 'varchar', length: 50, nullable: true })
  generated_by_user_id: string | null;

  @Column({ name: 'generated_by_name', type: 'varchar', length: 150, nullable: true })
  generated_by_name: string | null;

  @Column({ name: 'counted_by_user_id', type: 'varchar', length: 50, nullable: true })
  counted_by_user_id: string | null;

  @Column({ name: 'counted_by_name', type: 'varchar', length: 150, nullable: true })
  counted_by_name: string | null;

  @Column({ name: 'reviewed_by_user_id', type: 'varchar', length: 50, nullable: true })
  reviewed_by_user_id: string | null;

  @Column({ name: 'reviewed_by_name', type: 'varchar', length: 150, nullable: true })
  reviewed_by_name: string | null;

  @Column({ name: 'submitted_at', type: 'datetime', nullable: true })
  submitted_at: Date | null;

  @Column({ name: 'reviewed_at', type: 'datetime', nullable: true })
  reviewed_at: Date | null;

  @Column({ name: 'closed_at', type: 'datetime', nullable: true })
  closed_at: Date | null;

  @Column({ name: 'line_count', type: 'int', default: 0 })
  line_count: number;

  @Column({ name: 'counted_line_count', type: 'int', default: 0 })
  counted_line_count: number;

  @Column({ name: 'matched_line_count', type: 'int', default: 0 })
  matched_line_count: number;

  @Column({ name: 'variance_line_count', type: 'int', default: 0 })
  variance_line_count: number;

  @Column({ name: 'critical_line_count', type: 'int', default: 0 })
  critical_line_count: number;

  @Column({ name: 'variance_quantity_total', type: 'decimal', precision: 15, scale: 4, default: 0 })
  variance_quantity_total: number;

  @Column({ name: 'variance_value_total', type: 'decimal', precision: 15, scale: 4, default: 0 })
  variance_value_total: number;

  @Column({ name: 'accuracy_score', type: 'decimal', precision: 7, scale: 2, default: 0 })
  accuracy_score: number;

  @Column({ name: 'escalation_required', type: 'boolean', default: false })
  escalation_required: boolean;

  @Column({ name: 'escalation_reason', type: 'varchar', length: 255, nullable: true })
  escalation_reason: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => InventoryCountSessionItem, (item) => item.session)
  items: InventoryCountSessionItem[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
