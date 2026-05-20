import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('announcements')
export class Announcement {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ length: 255 })
    title: string;

    @Column({ type: 'text' })
    message: string;

    @Column({
        type: 'enum',
        enum: ['info', 'warning', 'danger', 'success'],
        default: 'info',
    })
    type: string;

    @Column({
        type: 'enum',
        enum: ['all', 'enterprise_only', 'staff_only'],
        default: 'all',
    })
    target: string;

    @Column({
        type: 'enum',
        enum: ['draft', 'active', 'scheduled', 'expired'],
        default: 'active',
    })
    status: string;

    @Column({ name: 'expires_at', type: 'datetime', nullable: true })
    expires_at: Date;

    @Column({ type: 'int', default: 0 })
    views: number;

    @Column({ name: 'created_by', nullable: true })
    created_by: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
