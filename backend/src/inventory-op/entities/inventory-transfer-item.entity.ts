import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Client } from '../../platform/entities/client.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { InventoryTransfer } from './inventory-transfer.entity';

export const INVENTORY_TRANSFER_ITEM_STAGES = [
  'raw',
  'semi_prepared',
  'prepared',
] as const;

export type InventoryTransferItemStage = (typeof INVENTORY_TRANSFER_ITEM_STAGES)[number];

@Entity('inventory_transfer_items')
@Index(['client_id', 'item_id'])
@Index(['transfer_id'])
export class InventoryTransferItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @ManyToOne(() => InventoryTransfer, (transfer) => transfer.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transfer_id' })
  transfer: InventoryTransfer;

  @Column({ name: 'transfer_id' })
  transfer_id: number;

  @ManyToOne(() => InventoryItem)
  @JoinColumn({ name: 'item_id' })
  item: InventoryItem;

  @Column({ name: 'item_id' })
  item_id: number;

  @Column({
    name: 'production_stage',
    type: 'enum',
    enum: INVENTORY_TRANSFER_ITEM_STAGES,
    default: 'raw',
  })
  production_stage: InventoryTransferItemStage;

  @Column({
    name: 'requested_quantity',
    type: 'decimal',
    precision: 15,
    scale: 4,
  })
  requested_quantity: number;

  @Column({
    name: 'dispatched_quantity',
    type: 'decimal',
    precision: 15,
    scale: 4,
    default: 0,
  })
  dispatched_quantity: number;

  @Column({
    name: 'received_quantity',
    type: 'decimal',
    precision: 15,
    scale: 4,
    default: 0,
  })
  received_quantity: number;

  @Column({
    name: 'short_quantity',
    type: 'decimal',
    precision: 15,
    scale: 4,
    default: 0,
  })
  short_quantity: number;

  @Column({
    name: 'damaged_quantity',
    type: 'decimal',
    precision: 15,
    scale: 4,
    default: 0,
  })
  damaged_quantity: number;

  @Column({
    name: 'unit_cost',
    type: 'decimal',
    precision: 15,
    scale: 4,
    default: 0,
  })
  unit_cost: number;

  @Column({ name: 'variance_reason', type: 'text', nullable: true })
  variance_reason: string | null;
}

