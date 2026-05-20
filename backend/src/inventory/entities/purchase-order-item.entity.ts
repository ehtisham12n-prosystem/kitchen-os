import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { PurchaseOrder } from './purchase-order.entity';
import { InventoryItem } from './inventory-item.entity';

@Entity('purchase_order_items')
export class PurchaseOrderItem {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => PurchaseOrder, (po) => po.items)
    @JoinColumn({ name: 'po_id' })
    purchaseOrder: PurchaseOrder;

    @Column({ name: 'po_id' })
    po_id: number;

    @ManyToOne(() => InventoryItem)
    @JoinColumn({ name: 'item_id' })
    item: InventoryItem;

    @Column({ name: 'item_id' })
    item_id: number;

    @Column({ type: 'decimal', precision: 12, scale: 3 })
    quantity: number;

    @Column({
        name: 'unit_cost',
        type: 'decimal',
        precision: 12,
        scale: 2,
    })
    unit_cost: number;

    @Column({
        name: 'line_total',
        type: 'decimal',
        precision: 12,
        scale: 2,
    })
    line_total: number;

    // Legacy compatibility field (kept during transition)
    @Column({
        name: 'total_price',
        type: 'decimal',
        precision: 12,
        scale: 2,
        nullable: true,
    })
    legacy_total_price: number | null;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
