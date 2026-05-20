import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Branch } from './branch.entity';
import { Role } from './Roles.entity';
import { UserManagement } from './UserManagement.entity';

@Entity('user_roles')
@Index(['user_id', 'role_id', 'branch_id'], { unique: true })
export class UserRole {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => UserManagement, (user) => user.userRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserManagement;

  @Column({ name: 'user_id', type: 'int' })
  user_id: number;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @Column({ name: 'role_id', type: 'int' })
  role_id: number;

  @ManyToOne(() => Branch, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch | null;

  @Column({ name: 'branch_id', type: 'int', nullable: true })
  branch_id: number | null;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  is_primary: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
