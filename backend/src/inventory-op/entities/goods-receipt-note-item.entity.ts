import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Client } from '../../platform/entities/client.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { GoodsReceiptNote } from './goods-receipt-note.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';

@Entity('goods_receipt_note_items')
export class GoodsReceiptNoteItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => GoodsReceiptNote, (grn) => grn.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'grn_id' })
  grn: GoodsReceiptNote;

  @Column({ name: 'grn_id' })
  grn_id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @ManyToOne(() => PurchaseOrderItem, { nullable: true })
  @JoinColumn({ name: 'po_item_id' })
  purchase_order_item: PurchaseOrderItem | null;

  @Column({ name: 'po_item_id', type: 'int', nullable: true })
  po_item_id: number | null;

  @ManyToOne(() => InventoryItem)
  @JoinColumn({ name: 'item_id' })
  item: InventoryItem;

  @Column({ name: 'item_id' })
  item_id: number;

  @Column({
    name: 'ordered_quantity',
    type: 'decimal',
    precision: 15,
    scale: 4,
    default: 0,
  })
  ordered_quantity: number;

  @Column({
    name: 'received_quantity',
    type: 'decimal',
    precision: 15,
    scale: 4,
  })
  received_quantity: number;

  @Column({
    name: 'unit_cost',
    type: 'decimal',
    precision: 15,
    scale: 4,
    default: 0,
  })
  unit_cost: number;

  @Column({
    name: 'line_total',
    type: 'decimal',
    precision: 15,
    scale: 4,
    default: 0,
  })
  line_total: number;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;
}

