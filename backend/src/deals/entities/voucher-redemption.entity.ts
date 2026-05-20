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
import { Branch } from '../../setup/entities/branch.entity';
import { Voucher } from './voucher.entity';
import { Order } from '../../pos/entities/order.entity';
import { Customer } from '../../customers/entities/customer.entity';

@Entity('deal_voucher_redemptions')
@Index(['client_id', 'voucher_id', 'created_at'])
@Index(['client_id', 'order_id'], { unique: true })
export class VoucherRedemption {
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

  @ManyToOne(() => Voucher)
  @JoinColumn({ name: 'voucher_id' })
  voucher: Voucher;

  @Column({ name: 'voucher_id', type: 'int' })
  voucher_id: number;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'order_id', type: 'int' })
  order_id: number;

  @ManyToOne(() => Customer, { nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @Column({ name: 'customer_id', type: 'int', nullable: true })
  customer_id: number | null;

  @Column({ name: 'voucher_code', type: 'varchar', length: 50 })
  voucher_code: string;

  @Column({ name: 'sub_total', type: 'decimal', precision: 12, scale: 2, default: 0 })
  sub_total: number;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  discount_amount: number;

  @Column({ name: 'redeemed_by_user_id', type: 'int', nullable: true })
  redeemed_by_user_id: number | null;

  @CreateDateColumn()
  created_at: Date;
}

