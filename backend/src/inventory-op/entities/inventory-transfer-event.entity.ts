import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Client } from '../../platform/entities/client.entity';
import { InventoryTransfer } from './inventory-transfer.entity';

export const INVENTORY_TRANSFER_EVENT_ACTIONS = [
  'requested',
  'approved',
  'rejected',
  'cancelled',
  'dispatched',
  'received',
] as const;

export type InventoryTransferEventAction = (typeof INVENTORY_TRANSFER_EVENT_ACTIONS)[number];

@Entity('inventory_transfer_events')
@Index(['client_id', 'transfer_id'])
@Index(['transfer_id', 'created_at'])
export class InventoryTransferEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @ManyToOne(() => InventoryTransfer, (transfer) => transfer.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transfer_id' })
  transfer: InventoryTransfer;

  @Column({ name: 'transfer_id' })
  transfer_id: number;

  @Column({
    type: 'enum',
    enum: INVENTORY_TRANSFER_EVENT_ACTIONS,
  })
  action: InventoryTransferEventAction;

  @Column({ name: 'status_after', length: 50 })
  status_after: string;

  @Column({ name: 'actor_id', type: 'varchar', length: 100, nullable: true })
  actor_id: string | null;

  @Column({ name: 'actor_name', type: 'varchar', length: 150, nullable: true })
  actor_name: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'metadata_json', type: 'text', nullable: true })
  metadata_json: string | null;

  @CreateDateColumn()
  created_at: Date;
}

