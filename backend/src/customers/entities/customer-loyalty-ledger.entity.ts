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
import { Customer } from './customer.entity';
import { Order } from '../../pos/entities/order.entity';

@Entity('customer_loyalty_ledger')
@Index(['client_id', 'customer_id', 'created_at'])
@Index(['client_id', 'source_order_id', 'event_type'])
export class CustomerLoyaltyLedger {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch | null;

  @Column({ name: 'branch_id', type: 'int', nullable: true })
  branch_id: number | null;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ name: 'customer_id', type: 'int' })
  customer_id: number;

  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn({ name: 'source_order_id' })
  source_order: Order | null;

  @Column({ name: 'source_order_id', type: 'int', nullable: true })
  source_order_id: number | null;

  @Column({
    name: 'event_type',
    type: 'enum',
    enum: ['earn', 'redeem', 'adjust', 'expire', 'reverse'],
  })
  event_type: 'earn' | 'redeem' | 'adjust' | 'expire' | 'reverse';

  @Column({ name: 'points_delta', type: 'int' })
  points_delta: number;

  @Column({ name: 'balance_after', type: 'int', default: 0 })
  balance_after: number;

  @Column({ name: 'remarks', type: 'varchar', length: 255, nullable: true })
  remarks: string | null;

  @Column({ name: 'created_by_user_id', type: 'int', nullable: true })
  created_by_user_id: number | null;

  @CreateDateColumn()
  created_at: Date;
}

