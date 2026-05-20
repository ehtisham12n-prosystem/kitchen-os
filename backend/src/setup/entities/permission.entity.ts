import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { RolePermission } from './role-permission.entity';

@Entity('permissions')
@Unique(['key'])
@Index(['module'])
@Index(['scope'])
export class Permission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'key', type: 'varchar', length: 150 })
  key: string;

  @Column({ name: 'module', type: 'varchar', length: 60 })
  module: string;

  @Column({ name: 'action', type: 'varchar', length: 60 })
  action: string;

  @Column({ name: 'scope', type: 'varchar', length: 20 })
  scope: 'company' | 'branch' | 'own';

  @OneToMany(() => RolePermission, (rolePermission) => rolePermission.permission)
  rolePermissions: RolePermission[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
