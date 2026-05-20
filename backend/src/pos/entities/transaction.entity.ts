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
import { Shift } from './shift.entity';
import { UserManagement } from '../../setup/entities/UserManagement.entity';
import { OrderReturn } from './order-return.entity';

@Entity('transactions')
@Index(['order_id'])
@Index(['client_id', 'branch_id'])
export class Transaction {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Order)
    @JoinColumn({ name: 'order_id' })
    order: Order;

    @Column({ name: 'order_id' })
    order_id: number;

    @ManyToOne(() => OrderReturn, { nullable: true })
    @JoinColumn({ name: 'return_id' })
    return_record: OrderReturn | null;

    @Column({ name: 'return_id', type: 'int', nullable: true })
    return_id: number | null;

    @Column({ name: 'client_id', type: 'varchar', length: 20, nullable: true })
    client_id: string | null;

    @Column({ name: 'branch_id', type: 'int', nullable: true })
    branch_id: number | null;

    @ManyToOne(() => Shift, { nullable: true })
    @JoinColumn({ name: 'shift_id' })
    shift: Shift | null;

    @Column({ name: 'shift_id', type: 'int', nullable: true })
    shift_id: number | null;

    @ManyToOne(() => UserManagement, { nullable: true })
    @JoinColumn({ name: 'user_id' })
    user: UserManagement | null;

    @Column({ name: 'user_id', type: 'int', nullable: true })
    user_id: number | null;

    @Column({ name: 'amount', type: 'decimal', precision: 12, scale: 2 })
    amount: number;

    @Column({
        type: 'enum',
        enum: ['cash', 'bank', 'card', 'digital_wallet', 'other'],
        default: 'cash',
    })
    payment_mode: string;

    @Column({ name: 'reference_number', type: 'varchar', length: 100, nullable: true })
    reference_number: string | null; // e.g., Credit card auth ID

    @Column({ name: 'payment_details', type: 'json', nullable: true })
    payment_details: Record<string, any> | null;

    @Column({ name: 'is_refund', type: 'boolean', default: false })
    is_refund: boolean;

    @CreateDateColumn()
    transaction_date: Date;
}
