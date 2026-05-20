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
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';

@Entity('inventory_stock_ledger')
@Index(['client_id', 'branch_id', 'item_id'])
export class StockLedger {
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

    @ManyToOne(() => InventoryItem)
    @JoinColumn({ name: 'item_id' })
    item: InventoryItem;

    @Column({ name: 'item_id' })
    item_id: number;

    @Column({
        name: 'quantity',
        type: 'decimal',
        precision: 15,
        scale: 4,
    })
    quantity: number; // Positive for additions, negative for subtractions

    @Column({
        name: 'transaction_type',
        type: 'enum',
        enum: ['purchase', 'sale', 'adjustment', 'transfer', 'wastage', 'production'],
        default: 'purchase',
    })
    transaction_type: string;

    @Column({ name: 'reference_id', length: 100, nullable: true })
    reference_id: string; // E.g., PO ID, Order ID, Adjustment Reason

    @Column({
        name: 'unit_cost',
        type: 'decimal',
        precision: 15,
        scale: 4,
        default: 0,
    })
    unit_cost: number; // The specific cost for this batch

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}

