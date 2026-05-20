import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('auth_access_logs')
export class AuthAccessLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'session_id', type: 'char', length: 36, nullable: true })
  session_id: string | null;

  @Column({ name: 'request_id', type: 'varchar', length: 100, nullable: true })
  request_id: string | null;

  @Column({ name: 'user_id', type: 'varchar', length: 64, nullable: true })
  user_id: string | null;

  @Column({ name: 'username', type: 'varchar', length: 150, nullable: true })
  username: string | null;

  @Column({ name: 'user_type', type: 'varchar', length: 30, nullable: true })
  user_type: string | null;

  @Column({ name: 'client_id', type: 'varchar', length: 20, nullable: true })
  client_id: string | null;

  @Column({ name: 'branch_id', type: 'int', nullable: true })
  branch_id: number | null;

  @Column({
    name: 'portal',
    type: 'enum',
    enum: ['Nexus', 'Console', 'Terminal', 'Public'],
    default: 'Console',
  })
  portal: 'Nexus' | 'Console' | 'Terminal' | 'Public';

  @Column({ name: 'request_method', type: 'varchar', length: 10 })
  request_method: string;

  @Column({ name: 'request_path', type: 'varchar', length: 255 })
  request_path: string;

  @Column({ name: 'status_code', type: 'int' })
  status_code: number;

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ip_address: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  user_agent: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  created_at: Date;

  @Column({ name: 'retention_until', type: 'datetime', nullable: true })
  retention_until: Date | null;
}
