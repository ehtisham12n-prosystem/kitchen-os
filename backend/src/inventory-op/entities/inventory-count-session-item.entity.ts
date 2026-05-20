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
import { BranchLocation } from '../../setup/entities/branch-location.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { InventoryCountSession } from './inventory-count-session.entity';

export const INVENTORY_DISCREPANCY_LEVELS = [
  'none',
  'low',
  'medium',
  'high',
  'critical',
] as const;

export const INVENTORY_REVIEW_ACTIONS = [
  'accept',
  'recount',
  'adjust_stock',
  'escalate',
] as const;

@Entity('inventory_count_session_items')
@Index(['session_id', 'item_id'], { unique: true })
@Index(['client_id', 'branch_id', 'discrepancy_level'])
export class InventoryCountSessionItem {
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

  @ManyToOne(() => InventoryCountSession, (session) => session.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: InventoryCountSession;

  @Column({ name: 'session_id', type: 'int' })
  session_id: number;

  @ManyToOne(() => BranchLocation, { nullable: true })
  @JoinColumn({ name: 'location_id' })
  location: BranchLocation | null;

  @Column({ name: 'location_id', type: 'int', nullable: true })
  location_id: number | null;

  @ManyToOne(() => InventoryItem)
  @JoinColumn({ name: 'item_id' })
  item: InventoryItem;

  @Column({ name: 'item_id', type: 'int' })
  item_id: number;

  @Column({ name: 'blind_sequence', type: 'int', default: 0 })
  blind_sequence: number;

  @Column({ name: 'expected_quantity_snapshot', type: 'decimal', precision: 15, scale: 4, default: 0 })
  expected_quantity_snapshot: number;

  @Column({ name: 'counted_quantity', type: 'decimal', precision: 15, scale: 4, nullable: true })
  counted_quantity: number | null;

  @Column({ name: 'variance_quantity', type: 'decimal', precision: 15, scale: 4, default: 0 })
  variance_quantity: number;

  @Column({ name: 'variance_percent', type: 'decimal', precision: 9, scale: 2, default: 0 })
  variance_percent: number;

  @Column({ name: 'estimated_unit_cost', type: 'decimal', precision: 15, scale: 4, default: 0 })
  estimated_unit_cost: number;

  @Column({ name: 'variance_value', type: 'decimal', precision: 15, scale: 4, default: 0 })
  variance_value: number;

  @Column({
    name: 'discrepancy_level',
    type: 'enum',
    enum: INVENTORY_DISCREPANCY_LEVELS,
    default: 'none',
  })
  discrepancy_level: (typeof INVENTORY_DISCREPANCY_LEVELS)[number];

  @Column({ name: 'review_status', type: 'varchar', length: 30, default: 'pending' })
  review_status: string;

  @Column({
    name: 'review_action',
    type: 'enum',
    enum: INVENTORY_REVIEW_ACTIONS,
    nullable: true,
  })
  review_action: (typeof INVENTORY_REVIEW_ACTIONS)[number] | null;

  @Column({ name: 'reason_code', type: 'varchar', length: 60, nullable: true })
  reason_code: string | null;

  @Column({ name: 'review_notes', type: 'varchar', length: 500, nullable: true })
  review_notes: string | null;

  @Column({ name: 'adjustment_reference_id', type: 'varchar', length: 100, nullable: true })
  adjustment_reference_id: string | null;

  @Column({ name: 'counted_at', type: 'datetime', nullable: true })
  counted_at: Date | null;

  @Column({ name: 'reviewed_at', type: 'datetime', nullable: true })
  reviewed_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
