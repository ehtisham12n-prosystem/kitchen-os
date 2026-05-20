import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
    Index,
} from 'typeorm';
import { Branch } from './branch.entity';
import { KitchenTableEntity } from './table.entity';

@Entity('floors')
@Index(['branch_id'])
export class Floor {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Branch)
    @JoinColumn({ name: 'branch_id' })
    branch: Branch;

    @Column({ name: 'branch_id' })
    branch_id: number;

    @Column({ name: 'floor_name', length: 100 })
    floor_name: string; // e.g., 'Ground Floor', 'Rooftop', 'Indoor'

    @Column({ name: 'floor_code', length: 50, nullable: true })
    floor_code: string;

    @Column({ name: 'description', type: 'text', nullable: true })
    description: string;

    @Column({ name: 'display_order', type: 'int', default: 0 })
    display_order: number;

    @OneToMany(() => KitchenTableEntity, (table) => table.floor)
    tables: KitchenTableEntity[];

    @Column({ name: 'is_active', type: 'boolean', default: true })
    is_active: boolean;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
