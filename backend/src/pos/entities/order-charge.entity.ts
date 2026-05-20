import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Order } from './order.entity';

@Entity('order_charges')
@Index(['order_id'])
export class OrderCharge {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'order_id' })
  order_id: number;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @Column({ name: 'branch_id', type: 'int', nullable: true })
  branch_id: number | null;

  @Column({ length: 100 })
  charge_name: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  applied_rate: string | null; // e.g., "15% (Cash)"

  @Column({ type: 'boolean', default: false })
  is_tax: boolean;

  @CreateDateColumn()
  created_at: Date;
}
