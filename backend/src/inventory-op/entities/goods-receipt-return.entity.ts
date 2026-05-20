import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Client } from '../../platform/entities/client.entity';
import { Branch } from '../../setup/entities/branch.entity';
import { Vendor } from '../../inventory/entities/vendor.entity';
import { GoodsReceiptNote } from './goods-receipt-note.entity';
import { GoodsReceiptReturnItem } from './goods-receipt-return-item.entity';

@Entity('goods_receipt_returns')
@Index(['client_id', 'return_number'], { unique: true })
@Index(['client_id', 'branch_id'])
@Index(['client_id', 'grn_id'])
export class GoodsReceiptReturn {
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

  @Column({ name: 'branch_id', type: 'int' })
  branch_id: number;

  @ManyToOne(() => GoodsReceiptNote)
  @JoinColumn({ name: 'grn_id' })
  grn: GoodsReceiptNote;

  @Column({ name: 'grn_id', type: 'int' })
  grn_id: number;

  @ManyToOne(() => Vendor, { nullable: true })
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor | null;

  @Column({ name: 'vendor_id', type: 'int', nullable: true })
  vendor_id: number | null;

  @Column({ name: 'return_number', type: 'varchar', length: 50 })
  return_number: string;

  @Column({ name: 'return_date', type: 'datetime' })
  return_date: Date;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'posted' })
  status: 'posted' | 'voided';

  @Column({ name: 'debit_note_reference', type: 'varchar', length: 100, nullable: true })
  debit_note_reference: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'returned_by', type: 'varchar', length: 100, nullable: true })
  returned_by: string | null;

  @Column({ name: 'returned_by_name', type: 'varchar', length: 150, nullable: true })
  returned_by_name: string | null;

  @OneToMany(() => GoodsReceiptReturnItem, (item) => item.return_doc, { cascade: true })
  items: GoodsReceiptReturnItem[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
