import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
    OneToMany,
} from 'typeorm';
import { Client } from '../../platform/entities/client.entity';
import { Branch } from '../../setup/entities/branch.entity';
import { Product } from '../../catalog/entities/product.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { InventoryTransfer } from '../../inventory-op/entities/inventory-transfer.entity';
import { Recipe } from '../../recipe/entities/recipe.entity';
import { ProductionOrderMaterial } from './production-order-material.entity';
import { ProductionOrderBatch } from './production-order-batch.entity';

@Entity('production_orders')
@Index(['client_id', 'branch_id'])
@Index(['client_id', 'destination_branch_id'])
@Index(['client_id', 'status'])
@Index(['client_id', 'production_no'], { unique: true })
export class ProductionOrder {
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

    @Column({ name: 'production_no', type: 'varchar', length: 50, nullable: true })
    production_no: string | null;

    @ManyToOne(() => Branch, { nullable: true })
    @JoinColumn({ name: 'destination_branch_id' })
    destination_branch: Branch | null;

    @Column({ name: 'destination_branch_id', type: 'int', nullable: true })
    destination_branch_id: number | null;

    @ManyToOne(() => Product)
    @JoinColumn({ name: 'product_id' })
    product: Product | null;

    @Column({ name: 'product_id', type: 'int', nullable: true })
    product_id: number | null;

    @ManyToOne(() => Recipe, { nullable: true })
    @JoinColumn({ name: 'recipe_id' })
    recipe: Recipe | null;

    @Column({ name: 'recipe_id', type: 'int', nullable: true })
    recipe_id: number | null;

    @ManyToOne(() => InventoryItem, { nullable: true })
    @JoinColumn({ name: 'prepared_item_id' })
    prepared_item: InventoryItem | null;

    @Column({ name: 'prepared_item_id', type: 'int', nullable: true })
    prepared_item_id: number | null;

    @Column({
        name: 'planned_quantity',
        type: 'decimal',
        precision: 15,
        scale: 4,
    })
    planned_quantity: number;

    @Column({
        name: 'actual_quantity',
        type: 'decimal',
        precision: 15,
        scale: 4,
        nullable: true,
    })
    actual_quantity: number; // Logged when finished

    @Column({ name: 'production_date', type: 'date', nullable: true })
    production_date: string | null;

    @Column({ name: 'required_at', type: 'datetime', nullable: true })
    required_at: Date | null;

    @Column({ name: 'planned_batch_count', type: 'int', default: 1 })
    planned_batch_count: number;

    @Column({ name: 'actual_batch_count', type: 'int', nullable: true })
    actual_batch_count: number | null;

    @Column({
        name: 'wastage_quantity',
        type: 'decimal',
        precision: 15,
        scale: 4,
        nullable: true,
    })
    wastage_quantity: number | null;

    @Column({
        name: 'yield_percentage',
        type: 'decimal',
        precision: 7,
        scale: 2,
        nullable: true,
    })
    yield_percentage: number | null;

    @Column({
        name: 'output_stage',
        type: 'enum',
        enum: ['semi_prepared', 'prepared'],
        default: 'prepared',
    })
    output_stage: 'semi_prepared' | 'prepared';

    @Column({
        name: 'status',
        type: 'enum',
        enum: ['requested', 'queued', 'in_preparation', 'prepared', 'dispatched', 'received', 'rejected', 'cancelled'],
        default: 'requested',
    })
    status: string;

    @Column({ name: 'requested_by', type: 'varchar', length: 100, nullable: true })
    requested_by: string | null;

    @Column({ name: 'requested_by_name', type: 'varchar', length: 150, nullable: true })
    requested_by_name: string | null;

    @Column({ name: 'requested_at', type: 'datetime', nullable: true })
    requested_at: Date | null;

    @Column({ name: 'queued_by', type: 'varchar', length: 100, nullable: true })
    queued_by: string | null;

    @Column({ name: 'queued_by_name', type: 'varchar', length: 150, nullable: true })
    queued_by_name: string | null;

    @Column({ name: 'queued_at', type: 'datetime', nullable: true })
    queued_at: Date | null;

    @Column({ name: 'issued_by', type: 'varchar', length: 100, nullable: true })
    issued_by: string | null;

    @Column({ name: 'issued_by_name', type: 'varchar', length: 150, nullable: true })
    issued_by_name: string | null;

    @Column({ name: 'materials_issued_at', type: 'datetime', nullable: true })
    materials_issued_at: Date | null;

    @Column({ name: 'issue_notes', type: 'text', nullable: true })
    issue_notes: string | null;

    @Column({ name: 'queue_notes', type: 'text', nullable: true })
    queue_notes: string | null;

    @Column({ name: 'start_date', type: 'datetime', nullable: true })
    start_date: Date | null;

    @Column({ name: 'completion_date', type: 'datetime', nullable: true })
    completion_date: Date | null;

    @Column({ name: 'completed_by', type: 'varchar', length: 100, nullable: true })
    completed_by: string | null;

    @Column({ name: 'completed_by_name', type: 'varchar', length: 150, nullable: true })
    completed_by_name: string | null;

    @Column({ name: 'completion_notes', type: 'text', nullable: true })
    completion_notes: string | null;

    @ManyToOne(() => InventoryTransfer, { nullable: true })
    @JoinColumn({ name: 'linked_transfer_id' })
    linked_transfer: InventoryTransfer | null;

    @Column({ name: 'linked_transfer_id', type: 'int', nullable: true })
    linked_transfer_id: number | null;

    @Column({ name: 'dispatch_notes', type: 'text', nullable: true })
    dispatch_notes: string | null;

    @Column({ name: 'receipt_notes', type: 'text', nullable: true })
    receipt_notes: string | null;

    @Column({ name: 'variance_notes', type: 'text', nullable: true })
    variance_notes: string | null;

    @Column({ name: 'rejection_notes', type: 'text', nullable: true })
    rejection_notes: string | null;

    @Column({ name: 'cancellation_notes', type: 'text', nullable: true })
    cancellation_notes: string | null;

    @Column({ name: 'source_unit_label', type: 'varchar', length: 100, nullable: true })
    source_unit_label: string | null;

    @Column({ name: 'destination_unit_label', type: 'varchar', length: 100, nullable: true })
    destination_unit_label: string | null;

    @Column({ name: 'notes', type: 'text', nullable: true })
    notes: string | null;

    @OneToMany(() => ProductionOrderMaterial, (material) => material.production_order)
    materials: ProductionOrderMaterial[];

    @OneToMany(() => ProductionOrderBatch, (batch) => batch.production_order)
    batches: ProductionOrderBatch[];

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}

