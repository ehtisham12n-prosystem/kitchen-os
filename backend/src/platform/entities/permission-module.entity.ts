import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
} from 'typeorm';
import { PermissionPage } from './permission-page.entity';

@Entity('permission_modules')
export class PermissionModule {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true, length: 50 })
    slug: string;

    @Column({ length: 100 })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ length: 50, default: 'LayoutGrid' })
    icon: string;

    @Column({ name: 'is_active', default: true })
    is_active: boolean;

    @OneToMany(() => PermissionPage, (page) => page.module)
    pages: PermissionPage[];

    @Column({ name: 'created_by', type: 'varchar', length: 255, nullable: true })
    created_by: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
