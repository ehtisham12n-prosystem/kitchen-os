import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Client } from '../../platform/entities/client.entity';
import { Branch } from '../../setup/entities/branch.entity';

export enum InventoryItemRequestStatus {
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
}

@Entity('inventory_item_requests')
@Index(['client_id', 'branch_id'])
export class InventoryItemRequest {
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

    @Column({ name: 'item_name', length: 150 })
    item_name: string;

    @Column({ name: 'item_number', length: 50, nullable: true })
    item_number: string;

    @Column({ name: 'uom_base', length: 50 })
    uom_base: string;

    @Column({ name: 'uom_purchase', length: 50, nullable: true })
    uom_purchase: string;

    @Column({ name: 'reason', type: 'text', nullable: true })
    reason: string;

    @Column({
        type: 'enum',
        enum: InventoryItemRequestStatus,
        default: InventoryItemRequestStatus.PENDING,
    })
    status: InventoryItemRequestStatus;

    @Column({ name: 'admin_comment', type: 'text', nullable: true })
    admin_comment: string | null;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}

