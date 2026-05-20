import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('system_groups')
export class SystemGroup {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'group_name', length: 100, unique: true })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'json', nullable: true })
    permissions: string[]; // ['nexus_clients.client_list.read', ...]

    @Column({ name: 'is_active', default: true })
    is_active: boolean;

    @Column({ name: 'is_system_default', default: false })
    is_system_default: boolean;

    @Column({ name: 'scope', type: 'enum', enum: ['nexus', 'client', 'branch'], default: 'nexus' })
    scope: string;

    @Column({ name: 'is_template', default: false })
    is_template: boolean;

    @Column({ name: 'created_by', nullable: true })
    created_by: string;

    @CreateDateColumn({ name: 'created_at' })
    created_at: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updated_at: Date;
}
