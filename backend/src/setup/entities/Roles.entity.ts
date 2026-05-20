import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Client } from '../../platform/entities/client.entity';
import { RolePermission } from './role-permission.entity';
import {
  ROLE_CONTEXT_SCOPES,
  USER_APPROVAL_AUTHORITIES,
  type RoleContextScope,
  type UserApprovalAuthority,
} from '../users/user-governance.constants';

@Entity('roles')
@Index(['client_id'])
@Index(['client_id', 'is_active'])
@Unique(['client_id', 'role_name'])
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @Column({ name: 'role_name', length: 100 })
  role_name: string;

  @Column({ name: 'name', type: 'varchar', length: 100, nullable: true })
  name: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({
    name: 'context_scope',
    type: 'enum',
    enum: ROLE_CONTEXT_SCOPES,
    default: 'hybrid',
  })
  context_scope: RoleContextScope;

  @Column({
    name: 'approval_authority',
    type: 'enum',
    enum: USER_APPROVAL_AUTHORITIES,
    nullable: true,
  })
  approval_authority: UserApprovalAuthority | null;

  @Column({ type: 'json' })
  permissions: string[];

  @OneToMany(() => RolePermission, (rolePermission) => rolePermission.role)
  rolePermissions: RolePermission[];

  @Column({ name: 'is_system_role', type: 'boolean', default: false })
  is_system_role: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

