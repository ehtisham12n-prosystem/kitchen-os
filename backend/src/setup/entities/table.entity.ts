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
import { Floor } from './floor.entity';
import { Branch } from './branch.entity';

@Entity('tables')
@Index(['branch_id'])
@Index(['floor_id'])
export class KitchenTableEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Branch)
    @JoinColumn({ name: 'branch_id' })
    branch: Branch;

    @Column({ name: 'branch_id' })
    branch_id: number;

    @ManyToOne(() => Floor)
    @JoinColumn({ name: 'floor_id' })
    floor: Floor;

    @Column({ name: 'floor_id' })
    floor_id: number;

    @Column({ name: 'table_number', length: 50 })
    table_number: string; // e.g., 'T-01', 'V-05'

    @Column({ name: 'table_name', length: 150, nullable: true })
    table_name: string;

    @Column({ name: 'capacity', type: 'int', default: 4 })
    capacity: number;

    @Column({
        type: 'enum',
        enum: ['vacant', 'occupied', 'reserved', 'cleaning'],
        default: 'vacant',
    })
    status: string;

    @Column({ name: 'is_active', type: 'boolean', default: true })
    is_active: boolean;

    @Column({ name: 'qr_code_token', length: 100, nullable: true })
    qr_code_token: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
