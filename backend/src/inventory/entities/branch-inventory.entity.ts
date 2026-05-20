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
import { Branch } from '../../setup/entities/branch.entity';
import { InventoryItem } from './inventory-item.entity';

@Entity('branch_inventory')
@Index(['branch_id', 'item_id'], { unique: true })
export class BranchInventory {
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
        name: 'current_stock',
        type: 'decimal',
        precision: 12,
        scale: 3,
        default: 0,
    })
    current_stock: number;

    @Column({
        name: 'min_stock_level',
        type: 'decimal',
        precision: 12,
        scale: 3,
        default: 0,
    })
    min_stock_level: number;

    @Column({
        name: 'max_stock_level',
        type: 'decimal',
        precision: 12,
        scale: 3,
        default: 0,
    })
    max_stock_level: number;

    @Column({ name: 'is_enabled', type: 'boolean', default: true })
    is_enabled: boolean;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
