import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Client } from '../../platform/entities/client.entity';

@Entity('departments')
export class Departments {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Client)
    @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
    client: Client;

    @Column({ name: 'client_id', type: 'varchar', length: 20 })
    clientId: string;

    @Column({ length: 50 })
    code: string;

    @Column({ length: 150 })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ name: 'head_name', length: 150, nullable: true })
    headName: string;

    @Column({ name: 'is_active', default: true })
    isActive: boolean;

    @Column({ name: 'branch_availability', type: 'json', nullable: true })
    branchAvailability: Record<string, boolean>;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}

