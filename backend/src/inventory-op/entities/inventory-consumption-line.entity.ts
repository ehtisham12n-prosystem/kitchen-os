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
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { InventoryConsumption } from './inventory-consumption.entity';

@Entity('inventory_consumption_lines')
@Index(['consumption_id'])
@Index(['item_id'])
export class InventoryConsumptionLine {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => InventoryConsumption, (consumption) => consumption.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'consumption_id' })
  consumption: InventoryConsumption;

  @Column({ name: 'consumption_id' })
  consumption_id: number;

  @ManyToOne(() => InventoryItem)
  @JoinColumn({ name: 'item_id' })
  item: InventoryItem;

  @Column({ name: 'item_id' })
  item_id: number;

  @Column({ name: 'item_name', type: 'varchar', length: 200 })
  item_name: string;

  @Column({ name: 'quantity', type: 'decimal', precision: 15, scale: 4 })
  quantity: number;

  @Column({ name: 'uom', type: 'varchar', length: 50, nullable: true })
  uom: string | null;

  @Column({ name: 'unit_cost', type: 'decimal', precision: 15, scale: 4, default: 0 })
  unit_cost: number;

  @Column({ name: 'total_cost', type: 'decimal', precision: 15, scale: 4, default: 0 })
  total_cost: number;

  @Column({ name: 'ledger_id', type: 'int', nullable: true })
  ledger_id: number | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
