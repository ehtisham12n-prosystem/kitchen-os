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

@Entity('uoms')
@Index(['client_id'])
export class Uom {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Client)
    @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
    client: Client;

    @Column({ name: 'client_id', type: 'varchar', length: 20 })
    client_id: string;

    @Column({ name: 'name', length: 50 })
    name: string; // e.g., 'Kilogram', 'Gram', 'Litre'

    @Column({ name: 'abbreviation', length: 30 })
    abbreviation: string; // e.g., 'kg', 'g', 'L'

    @Column({ name: 'uom_type', length: 20, default: 'count' })
    uom_type: 'weight' | 'volume' | 'count';

    @Column({ name: 'description', type: 'text', nullable: true })
    description: string | null;

    @Column({ name: 'is_base_unit', type: 'boolean', default: false })
    is_base_unit: boolean;

    @Column({ name: 'is_active', type: 'boolean', default: true })
    is_active: boolean;

    @ManyToOne(() => Uom, { nullable: true })
    @JoinColumn({ name: 'base_unit_id' })
    base_unit: Uom;

    @Column({ name: 'base_unit_id', nullable: true })
    base_unit_id: number | null;

    @Column({
        name: 'conversion_factor',
        type: 'decimal',
        precision: 18,
        scale: 8,
        nullable: true,
    })
    conversion_factor: number; // e.g., if this is 'Gram' and base is 'Kilogram', factor is 1000

    @Column({ name: 'branch_availability', type: 'json', nullable: true })
    branchAvailability: Record<string, boolean>;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}

