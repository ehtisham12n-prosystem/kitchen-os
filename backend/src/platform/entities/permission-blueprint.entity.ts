import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('permission_blueprints')
export class PermissionBlueprint {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true, length: 50 })
    slug: string; // e.g., 'fine_dining', 'fast_food'

    @Column({ length: 100 })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ length: 50, nullable: true })
    icon: string;

    @Column({ name: 'config_json', type: 'text', nullable: true })
    config_json: string; // Serialized boilerplate for roles, categories, uoms

    @Column({ name: 'is_active', default: true })
    is_active: boolean;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
