import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
} from 'typeorm';

@Entity('auth_audits')
export class AuthAudit {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'user_id' })
    user_id: string;

    @Column({
        type: 'enum',
        enum: ['system', 'client', 'customer'],
        name: 'user_type'
    })
    user_type: string;

    @Column({
        type: 'enum',
        enum: ['success', 'failure'],
        name: 'attempt_status'
    })
    attempt_status: string;

    @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
    ip_address: string | null;

    @Column({ name: 'UserManagement_agent', type: 'text', nullable: true })
    UserManagement_agent: string | null;

    @Column({ name: 'tenant_slug', type: 'varchar', length: 120, nullable: true })
    tenant_slug: string | null;

    @Column({ name: 'failure_reason', type: 'varchar', length: 255, nullable: true })
    failure_reason: string | null;

    @Column({ name: 'session_id', type: 'char', length: 36, nullable: true })
    session_id: string | null;

    @Column({ name: 'request_id', type: 'varchar', length: 100, nullable: true })
    request_id: string | null;

    @Column({ name: 'retention_until', type: 'datetime', nullable: true })
    retention_until: Date | null;

    @CreateDateColumn()
    created_at: Date;
}
