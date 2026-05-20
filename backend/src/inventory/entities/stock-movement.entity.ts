import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Branch } from '../../setup/entities/branch.entity';
import { InventoryItem } from './inventory-item.entity';

@Entity('inventory_stock_movements')
@Index(['branch_id', 'item_id'])
export class StockMovement {
    @PrimaryGeneratedColumn()
    id: number;

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
        type: 'decimal',
        precision: 12,
        scale: 3,
    })
    quantity: number; // Positive for addition, negative for reduction

    @Column({
        type: 'enum',
        enum: ['purchase', 'adjustment', 'sale', 'waste', 'transfer_in', 'transfer_out'],
    })
    type: string;

    @Column({ name: 'reference_id', nullable: true })
    reference_id: string; // e.g. PO number, Adjustment ID, Order ID

    @Column({ name: 'user_id', nullable: true })
    user_id: string; // Who made the transaction

    @Column({ name: 'notes', type: 'text', nullable: true })
    notes: string;

    @CreateDateColumn()
    created_at: Date;
}
