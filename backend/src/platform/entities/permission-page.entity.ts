import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { PermissionModule } from './permission-module.entity';

@Entity('permission_pages')
export class PermissionPage {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => PermissionModule, (module) => module.pages, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'module_id' })
    module: PermissionModule;

    @Column({ name: 'module_id' })
    module_id: string;

    @Column({ length: 100 })
    slug: string; // e.g., 'pos_terminal'

    @Column({ length: 150 })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'json' })
    actions: string[]; // e.g., ['read', 'create', 'void_order']

    @Column({ name: 'is_active', default: true })
    is_active: boolean;

    @Column({ name: 'created_by', type: 'varchar', length: 255, nullable: true })
    created_by: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
