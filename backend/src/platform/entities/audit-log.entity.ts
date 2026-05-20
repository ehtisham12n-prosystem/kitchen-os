import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
} from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'timestamp', type: 'datetime' })
    @CreateDateColumn()
    timestamp: Date;

    @Column({ name: 'user_id', type: 'varchar', length: 255, nullable: true })
    userId: string;

    @Column({ name: 'user_name', type: 'varchar', length: 255, nullable: true })
    UserManagementName: string;

    @Column({ name: 'UserManagement_role', type: 'varchar', length: 255, nullable: true })
    UserManagementRole: string;

    @Column({ name: 'actor_type', type: 'varchar', length: 50, nullable: true })
    actorType: string | null;

    @Column({ name: 'client_id', type: 'varchar', length: 20, nullable: true })
    clientId: string | null;

    @Column({ name: 'branch_id', type: 'int', nullable: true })
    branchId: number | null;

    @Column({ name: 'entity_id', type: 'varchar', length: 100, nullable: true })
    entityId: string | null;

    @Column({ name: 'request_method', type: 'varchar', length: 10, nullable: true })
    requestMethod: string | null;

    @Column({ name: 'request_path', type: 'varchar', length: 255, nullable: true })
    requestPath: string | null;

    @Column()
    action: string;

    @Column()
    entity: string;

    @Column({
        type: 'enum',
        enum: ['Nexus', 'Console', 'Terminal'],
        default: 'Nexus',
    })
    portal: string;

    @Column({ name: 'ip_address', type: 'varchar', length: 255, nullable: true })
    ipAddress: string;

    @Column({
        type: 'enum',
        enum: ['success', 'warning', 'error'],
        default: 'success',
    })
    status: string;

    @Column({ type: 'text', nullable: true })
    details: string;

    @Column({ name: 'diff_json', type: 'text', nullable: true })
    diffJson: string; // Serialized JSON array of { field, oldValue, newValue }

    @Column({ name: 'metadata_json', type: 'text', nullable: true })
    metadataJson: string; // Browser, OS, Method, etc.
}
