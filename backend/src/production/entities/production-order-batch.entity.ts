import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Client } from '../../platform/entities/client.entity';
import { ProductionOrder } from './production-order.entity';

export const PRODUCTION_ORDER_BATCH_STATUSES = ['planned', 'completed'] as const;

export type ProductionOrderBatchStatus = (typeof PRODUCTION_ORDER_BATCH_STATUSES)[number];

@Entity('production_order_batches')
@Index(['client_id', 'production_order_id'])
@Index(['client_id', 'batch_no'], { unique: true })
export class ProductionOrderBatch {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @ManyToOne(() => ProductionOrder, (order) => order.batches, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'production_order_id' })
  production_order: ProductionOrder;

  @Column({ name: 'production_order_id', type: 'int' })
  production_order_id: number;

  @Column({ name: 'batch_no', type: 'varchar', length: 50 })
  batch_no: string;

  @Column({ name: 'batch_sequence', type: 'int' })
  batch_sequence: number;

  @Column({
    name: 'planned_quantity',
    type: 'decimal',
    precision: 15,
    scale: 4,
    default: 0,
  })
  planned_quantity: number;

  @Column({
    name: 'actual_quantity',
    type: 'decimal',
    precision: 15,
    scale: 4,
    default: 0,
  })
  actual_quantity: number;

  @Column({
    name: 'wastage_quantity',
    type: 'decimal',
    precision: 15,
    scale: 4,
    default: 0,
  })
  wastage_quantity: number;

  @Column({
    name: 'yield_percentage',
    type: 'decimal',
    precision: 7,
    scale: 2,
    nullable: true,
  })
  yield_percentage: number | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: PRODUCTION_ORDER_BATCH_STATUSES,
    default: 'completed',
  })
  status: ProductionOrderBatchStatus;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completed_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

