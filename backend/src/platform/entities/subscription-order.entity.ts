import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Client } from './client.entity';
import { SubscriptionPlan } from './subscription-plan.entity';

@Entity('subscription_orders')
export class SubscriptionOrder {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Client)
    @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
    client: Client;

    @Column({ name: 'client_id', type: 'varchar', length: 20 })
    client_id: string;

    @ManyToOne(() => SubscriptionPlan)
    @JoinColumn({ name: 'plan_id' })
    plan: SubscriptionPlan;

    @Column({ name: 'plan_id' })
    plan_id: number;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    amount: number;

    @Column({
        type: 'enum',
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'paid',
    })
    status: string;

    @Column({ name: 'payment_date', type: 'datetime' })
    payment_date: Date;

    @Column({ name: 'billing_cycle_start', type: 'datetime', nullable: true })
    billing_cycle_start: Date;

    @Column({ name: 'billing_cycle_end', type: 'datetime', nullable: true })
    billing_cycle_end: Date;

    @Column({ name: 'transaction_id', nullable: true })
    transaction_id: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}

