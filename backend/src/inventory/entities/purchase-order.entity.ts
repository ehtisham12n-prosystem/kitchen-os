import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    OneToMany,
} from 'typeorm';
import { Client } from '../../platform/entities/client.entity';
import { Branch } from '../../setup/entities/branch.entity';
import { Vendor } from './vendor.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';
import {
    PROCUREMENT_MODES,
    PURCHASE_ORDER_APPROVAL_STATUSES,
    type ProcurementMode,
    type PurchaseOrderApprovalStatus,
} from '../../inventory-op/procurement.constants';

@Entity('purchase_orders')
export class PurchaseOrder {
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

    @Column({ name: 'branch_id' })
    branch_id: number;

    @ManyToOne(() => Branch, { nullable: true })
    @JoinColumn({ name: 'destination_branch_id' })
    destination_branch: Branch | null;

    @Column({ name: 'destination_branch_id', type: 'int', nullable: true })
    destination_branch_id: number | null;

    @ManyToOne(() => Vendor, { nullable: true })
    @JoinColumn({ name: 'vendor_id' })
    vendor: Vendor;

    @Column({ name: 'vendor_id', type: 'int', nullable: true })
    vendor_id: number | null;

    @Column({ name: 'po_number', type: 'varchar', length: 50, unique: true, nullable: true })
    po_number: string | null;

    @Column({
        type: 'enum',
        enum: ['draft', 'sent', 'received', 'cancelled'],
        default: 'draft',
    })
    status: string;

    @Column({
        name: 'total_amount',
        type: 'decimal',
        precision: 12,
        scale: 2,
        default: 0,
    })
    total_amount: number;

    @Column({ name: 'expected_delivery_date', type: 'date', nullable: true })
    expected_delivery_date: Date | null;

    @Column({ name: 'notes', type: 'text', nullable: true })
    notes: string | null;

    @Column({ name: 'destination_store_label', type: 'varchar', length: 100, nullable: true })
    destination_store_label: string | null;

    @Column({
        name: 'procurement_mode',
        type: 'enum',
        enum: PROCUREMENT_MODES,
        default: 'branch_direct',
    })
    procurement_mode: ProcurementMode;

    @Column({
        name: 'approval_status',
        type: 'enum',
        enum: PURCHASE_ORDER_APPROVAL_STATUSES,
        default: 'not_required',
    })
    approval_status: PurchaseOrderApprovalStatus;

    @Column({ name: 'approved_by', type: 'varchar', length: 100, nullable: true })
    approved_by: string | null;

    @Column({ name: 'approved_by_name', type: 'varchar', length: 150, nullable: true })
    approved_by_name: string | null;

    @Column({ name: 'approved_at', type: 'datetime', nullable: true })
    approved_at: Date | null;

    @Column({ name: 'approval_notes', type: 'text', nullable: true })
    approval_notes: string | null;

    @Column({ name: 'procurement_request_id', type: 'int', nullable: true })
    procurement_request_id: number | null;

    // Legacy compatibility fields (kept during transition)
    @Column({
        name: 'po_status',
        type: 'enum',
        enum: ['draft', 'ordered', 'received', 'cancelled'],
        nullable: true,
    })
    legacy_status: string | null;

    @Column({
        name: 'total_cost',
        type: 'decimal',
        precision: 15,
        scale: 2,
        nullable: true,
    })
    legacy_total_cost: number | null;

    @Column({ name: 'expected_date', type: 'date', nullable: true })
    legacy_expected_date: Date | null;

    @OneToMany(() => PurchaseOrderItem, (item) => item.purchaseOrder, {
        cascade: true,
    })
    items: PurchaseOrderItem[];

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}

