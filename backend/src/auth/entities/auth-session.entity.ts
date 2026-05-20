import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('auth_sessions')
export class AuthSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'session_id', type: 'char', length: 36, unique: true })
  session_id: string;

  @Column({ name: 'user_id', type: 'varchar', length: 64 })
  user_id: string;

  @Column({ name: 'username', type: 'varchar', length: 150, nullable: true })
  username: string | null;

  @Column({
    name: 'user_type',
    type: 'enum',
    enum: ['system', 'client', 'customer'],
  })
  user_type: 'system' | 'client' | 'customer';

  @Column({ name: 'client_id', type: 'varchar', length: 20, nullable: true })
  client_id: string | null;

  @Column({ name: 'branch_id', type: 'int', nullable: true })
  branch_id: number | null;

  @Column({ name: 'tenant_slug', type: 'varchar', length: 120, nullable: true })
  tenant_slug: string | null;

  @Column({
    name: 'portal',
    type: 'enum',
    enum: ['Nexus', 'Console', 'Terminal', 'Public'],
    default: 'Console',
  })
  portal: 'Nexus' | 'Console' | 'Terminal' | 'Public';

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ip_address: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  user_agent: string | null;

  @Column({ name: 'device_label', type: 'varchar', length: 120, nullable: true })
  device_label: string | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ['active', 'revoked', 'expired'],
    default: 'active',
  })
  status: 'active' | 'revoked' | 'expired';

  @CreateDateColumn({ name: 'issued_at', type: 'datetime' })
  issued_at: Date;

  @Column({ name: 'expires_at', type: 'datetime' })
  expires_at: Date;

  @Column({ name: 'last_seen_at', type: 'datetime', nullable: true })
  last_seen_at: Date | null;

  @Column({ name: 'last_seen_ip', type: 'varchar', length: 64, nullable: true })
  last_seen_ip: string | null;

  @Column({ name: 'last_seen_user_agent', type: 'text', nullable: true })
  last_seen_user_agent: string | null;

  @Column({ name: 'last_seen_path', type: 'varchar', length: 255, nullable: true })
  last_seen_path: string | null;

  @Column({ name: 'revoked_at', type: 'datetime', nullable: true })
  revoked_at: Date | null;

  @Column({ name: 'revoke_reason', type: 'varchar', length: 255, nullable: true })
  revoke_reason: string | null;

  @Column({ name: 'request_id', type: 'varchar', length: 100, nullable: true })
  request_id: string | null;

  @Column({ name: 'retention_until', type: 'datetime', nullable: true })
  retention_until: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updated_at: Date;
}
