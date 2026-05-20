import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Client } from '../../platform/entities/client.entity';
import { Branch } from '../../setup/entities/branch.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';

@Entity('inventory_stock_levels')
@Index(['client_id', 'branch_id', 'item_id'], { unique: true })
export class StockLevel {
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
        name: 'current_quantity',
        type: 'decimal',
        precision: 15,
        scale: 4,
        default: 0,
    })
    current_quantity: number;

    @Column({
        name: 'last_unit_cost',
        type: 'decimal',
        precision: 15,
        scale: 4,
        default: 0,
    })
    last_unit_cost: number;

    @Column({ name: 'last_received_at', type: 'datetime', nullable: true })
    last_received_at: Date | null;

    @UpdateDateColumn()
    updated_at: Date;
}

