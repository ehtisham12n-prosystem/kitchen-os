import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Client } from '../../platform/entities/client.entity';

@Entity('stations')
@Index(['client_id'])
export class Station {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Client)
    @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
    client: Client;

    @Column({ name: 'client_id', type: 'varchar', length: 20 })
    client_id: string;

    @Column({ name: 'name', length: 100 })
    name: string; // e.g., 'Grill', 'Salad', 'Bar'

    @Column({ name: 'code', length: 50, nullable: true })
    code: string;

    @Column({ name: 'description', type: 'text', nullable: true })
    description: string;

    @Column({ name: 'is_active', type: 'boolean', default: true })
    is_active: boolean;

    @Column({ name: 'supports_hot_food', type: 'boolean', default: false })
    supports_hot_food: boolean;

    @Column({ name: 'supports_cold_food', type: 'boolean', default: false })
    supports_cold_food: boolean;

    @Column({ name: 'kitchen_display_order', type: 'int', default: 0 })
    kitchen_display_order: number;

    @Column({ name: 'branch_availability', type: 'json', nullable: true })
    branchAvailability: Record<string, boolean>;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}

