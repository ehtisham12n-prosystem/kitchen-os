import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { ProcurementRequest } from './procurement-request.entity';

@Entity('procurement_request_items')
export class ProcurementRequestItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ProcurementRequest, (request) => request.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'request_id' })
  request: ProcurementRequest;

  @Column({ name: 'request_id' })
  request_id: number;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @ManyToOne(() => InventoryItem)
  @JoinColumn({ name: 'item_id' })
  item: InventoryItem;

  @Column({ name: 'item_id' })
  item_id: number;

  @Column({
    name: 'requested_quantity',
    type: 'decimal',
    precision: 15,
    scale: 4,
  })
  requested_quantity: number;

  @Column({
    name: 'approved_quantity',
    type: 'decimal',
    precision: 15,
    scale: 4,
    nullable: true,
  })
  approved_quantity: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
