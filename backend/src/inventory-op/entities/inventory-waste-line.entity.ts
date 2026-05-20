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
import { InventoryWaste } from './inventory-waste.entity';

@Entity('inventory_waste_lines')
@Index(['waste_id'])
export class InventoryWasteLine {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => InventoryWaste, (waste) => waste.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'waste_id' })
  waste: InventoryWaste;

  @Column({ name: 'waste_id' })
  waste_id: number;

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

  @Column({ name: 'cost', type: 'decimal', precision: 15, scale: 4, default: 0 })
  cost: number;

  @Column({ name: 'ledger_id', type: 'int', nullable: true })
  ledger_id: number | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
