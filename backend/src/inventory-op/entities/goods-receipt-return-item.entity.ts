import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Client } from '../../platform/entities/client.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { GoodsReceiptNoteItem } from './goods-receipt-note-item.entity';
import { GoodsReceiptReturn } from './goods-receipt-return.entity';

@Entity('goods_receipt_return_items')
export class GoodsReceiptReturnItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => GoodsReceiptReturn, (returnDoc) => returnDoc.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'return_id' })
  return_doc: GoodsReceiptReturn;

  @Column({ name: 'return_id', type: 'int' })
  return_id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @ManyToOne(() => GoodsReceiptNoteItem)
  @JoinColumn({ name: 'grn_item_id' })
  grn_item: GoodsReceiptNoteItem;

  @Column({ name: 'grn_item_id', type: 'int' })
  grn_item_id: number;

  @ManyToOne(() => InventoryItem)
  @JoinColumn({ name: 'item_id' })
  item: InventoryItem;

  @Column({ name: 'item_id', type: 'int' })
  item_id: number;

  @Column({ name: 'returned_quantity', type: 'decimal', precision: 15, scale: 4 })
  returned_quantity: number;

  @Column({ name: 'unit_cost', type: 'decimal', precision: 15, scale: 4, default: 0 })
  unit_cost: number;

  @Column({ name: 'line_total', type: 'decimal', precision: 15, scale: 4, default: 0 })
  line_total: number;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;
}
