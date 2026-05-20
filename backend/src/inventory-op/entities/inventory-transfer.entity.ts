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
import { InventoryTransferEvent } from './inventory-transfer-event.entity';
import { InventoryTransferItem } from './inventory-transfer-item.entity';

export const INVENTORY_TRANSFER_FLOW_TYPES = [
  'stock_transfer',
  'production_supply',
] as const;

export type InventoryTransferFlowType = (typeof INVENTORY_TRANSFER_FLOW_TYPES)[number];

export const INVENTORY_TRANSFER_STATUSES = [
  'requested',
  'approved',
  'rejected',
  'cancelled',
  'in_transit',
  'received',
  'received_with_variance',
] as const;

export type InventoryTransferStatus = (typeof INVENTORY_TRANSFER_STATUSES)[number];

@Entity('inventory_transfers')
@Index(['client_id', 'transfer_no'], { unique: true })
@Index(['client_id', 'status'])
@Index(['client_id', 'flow_type'])
@Index(['client_id', 'flow_type', 'status'])
@Index(['client_id', 'source_branch_id'])
@Index(['client_id', 'destination_branch_id'])
export class InventoryTransfer {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @Column({ name: 'transfer_no', length: 50 })
  transfer_no: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'source_branch_id' })
  source_branch: Branch;

  @Column({ name: 'source_branch_id' })
  source_branch_id: number;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'destination_branch_id' })
  destination_branch: Branch;

  @Column({ name: 'destination_branch_id' })
  destination_branch_id: number;

  @Column({ name: 'source_store_label', type: 'varchar', length: 100, nullable: true })
  source_store_label: string | null;

  @Column({ name: 'destination_store_label', type: 'varchar', length: 100, nullable: true })
  destination_store_label: string | null;

  @Column({ name: 'reason_code', type: 'varchar', length: 50, nullable: true })
  reason_code: string | null;

  @Column({ name: 'origin_production_order_id', type: 'int', nullable: true })
  origin_production_order_id: number | null;

  @Column({ name: 'origin_production_no', type: 'varchar', length: 50, nullable: true })
  origin_production_no: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({
    name: 'flow_type',
    type: 'enum',
    enum: INVENTORY_TRANSFER_FLOW_TYPES,
    default: 'stock_transfer',
  })
  flow_type: InventoryTransferFlowType;

  @Column({ name: 'require_approval', type: 'boolean', default: true })
  require_approval: boolean;

  @Column({
    type: 'enum',
    enum: INVENTORY_TRANSFER_STATUSES,
    default: 'requested',
  })
  status: InventoryTransferStatus;

  @Column({ name: 'requested_by', type: 'varchar', length: 100, nullable: true })
  requested_by: string | null;

  @Column({ name: 'requested_by_name', type: 'varchar', length: 150, nullable: true })
  requested_by_name: string | null;

  @CreateDateColumn({ name: 'requested_at' })
  requested_at: Date;

  @Column({ name: 'approved_by', type: 'varchar', length: 100, nullable: true })
  approved_by: string | null;

  @Column({ name: 'approved_by_name', type: 'varchar', length: 150, nullable: true })
  approved_by_name: string | null;

  @Column({ name: 'approved_at', type: 'datetime', nullable: true })
  approved_at: Date | null;

  @Column({ name: 'approval_notes', type: 'text', nullable: true })
  approval_notes: string | null;

  @Column({ name: 'rejected_by', type: 'varchar', length: 100, nullable: true })
  rejected_by: string | null;

  @Column({ name: 'rejected_by_name', type: 'varchar', length: 150, nullable: true })
  rejected_by_name: string | null;

  @Column({ name: 'rejected_at', type: 'datetime', nullable: true })
  rejected_at: Date | null;

  @Column({ name: 'rejection_notes', type: 'text', nullable: true })
  rejection_notes: string | null;

  @Column({ name: 'cancelled_by', type: 'varchar', length: 100, nullable: true })
  cancelled_by: string | null;

  @Column({ name: 'cancelled_by_name', type: 'varchar', length: 150, nullable: true })
  cancelled_by_name: string | null;

  @Column({ name: 'cancelled_at', type: 'datetime', nullable: true })
  cancelled_at: Date | null;

  @Column({ name: 'cancellation_notes', type: 'text', nullable: true })
  cancellation_notes: string | null;

  @Column({ name: 'dispatched_by', type: 'varchar', length: 100, nullable: true })
  dispatched_by: string | null;

  @Column({ name: 'dispatched_by_name', type: 'varchar', length: 150, nullable: true })
  dispatched_by_name: string | null;

  @Column({ name: 'dispatched_at', type: 'datetime', nullable: true })
  dispatched_at: Date | null;

  @Column({ name: 'dispatch_notes', type: 'text', nullable: true })
  dispatch_notes: string | null;

  @Column({ name: 'received_by', type: 'varchar', length: 100, nullable: true })
  received_by: string | null;

  @Column({ name: 'received_by_name', type: 'varchar', length: 150, nullable: true })
  received_by_name: string | null;

  @Column({ name: 'received_at', type: 'datetime', nullable: true })
  received_at: Date | null;

  @Column({ name: 'receipt_notes', type: 'text', nullable: true })
  receipt_notes: string | null;

  @Column({ name: 'variance_notes', type: 'text', nullable: true })
  variance_notes: string | null;

  @Column({ name: 'finance_reviewed_by', type: 'varchar', length: 100, nullable: true })
  finance_reviewed_by: string | null;

  @Column({ name: 'finance_reviewed_by_name', type: 'varchar', length: 150, nullable: true })
  finance_reviewed_by_name: string | null;

  @Column({ name: 'finance_reviewed_at', type: 'datetime', nullable: true })
  finance_reviewed_at: Date | null;

  @Column({ name: 'finance_review_notes', type: 'text', nullable: true })
  finance_review_notes: string | null;

  @OneToMany(() => InventoryTransferItem, (item) => item.transfer)
  items: InventoryTransferItem[];

  @OneToMany(() => InventoryTransferEvent, (event) => event.transfer)
  events: InventoryTransferEvent[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

