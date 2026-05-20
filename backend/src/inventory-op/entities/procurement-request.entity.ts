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
import { Vendor } from '../../inventory/entities/vendor.entity';
import {
  PROCUREMENT_APPROVAL_SCOPES,
  PROCUREMENT_CONTEXTS,
  PROCUREMENT_MODES,
  PROCUREMENT_REQUEST_PRIORITIES,
  PROCUREMENT_REQUEST_STATUSES,
  type ProcurementApprovalScope,
  type ProcurementContext,
  type ProcurementMode,
  type ProcurementRequestPriority,
  type ProcurementRequestStatus,
} from '../procurement.constants';
import { ProcurementRequestItem } from './procurement-request-item.entity';

@Entity('procurement_requests')
@Index(['client_id', 'request_no'], { unique: true })
@Index(['client_id', 'status'])
@Index(['client_id', 'requesting_branch_id'])
@Index(['client_id', 'destination_branch_id'])
export class ProcurementRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @Column({ name: 'request_no', length: 50 })
  request_no: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'requesting_branch_id' })
  requesting_branch: Branch;

  @Column({ name: 'requesting_branch_id' })
  requesting_branch_id: number;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'destination_branch_id' })
  destination_branch: Branch;

  @Column({ name: 'destination_branch_id' })
  destination_branch_id: number;

  @ManyToOne(() => Vendor, { nullable: true })
  @JoinColumn({ name: 'preferred_vendor_id' })
  preferred_vendor: Vendor | null;

  @Column({ name: 'preferred_vendor_id', type: 'int', nullable: true })
  preferred_vendor_id: number | null;

  @Column({
    name: 'procurement_mode',
    type: 'enum',
    enum: PROCUREMENT_MODES,
    default: 'branch_direct',
  })
  procurement_mode: ProcurementMode;

  @Column({
    name: 'procurement_context',
    type: 'enum',
    enum: PROCUREMENT_CONTEXTS,
    default: 'branch_procurement',
  })
  procurement_context: ProcurementContext;

  @Column({
    name: 'approval_scope',
    type: 'enum',
    enum: PROCUREMENT_APPROVAL_SCOPES,
    default: 'branch',
  })
  approval_scope: ProcurementApprovalScope;

  @Column({
    name: 'priority',
    type: 'enum',
    enum: PROCUREMENT_REQUEST_PRIORITIES,
    default: 'routine',
  })
  priority: ProcurementRequestPriority;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({
    type: 'enum',
    enum: PROCUREMENT_REQUEST_STATUSES,
    default: 'pending',
  })
  status: ProcurementRequestStatus;

  @Column({ name: 'requested_by', type: 'varchar', length: 100, nullable: true })
  requested_by: string | null;

  @Column({ name: 'requested_by_name', type: 'varchar', length: 150, nullable: true })
  requested_by_name: string | null;

  @CreateDateColumn({ name: 'requested_at' })
  requested_at: Date;

  @Column({ name: 'reviewed_by', type: 'varchar', length: 100, nullable: true })
  reviewed_by: string | null;

  @Column({ name: 'reviewed_by_name', type: 'varchar', length: 150, nullable: true })
  reviewed_by_name: string | null;

  @Column({ name: 'reviewed_at', type: 'datetime', nullable: true })
  reviewed_at: Date | null;

  @Column({ name: 'review_notes', type: 'text', nullable: true })
  review_notes: string | null;

  @Column({ name: 'linked_po_id', type: 'int', nullable: true })
  linked_po_id: number | null;

  @OneToMany(() => ProcurementRequestItem, (item) => item.request, {
    cascade: true,
  })
  items: ProcurementRequestItem[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

