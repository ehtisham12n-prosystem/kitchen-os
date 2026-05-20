import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { UserManagement } from './UserManagement.entity';
import { Branch } from './branch.entity';
import { Role } from './Roles.entity';
import {
    USER_APPROVAL_AUTHORITIES,
    USER_BRANCH_ASSIGNMENT_SCOPES,
    type UserApprovalAuthority,
    type UserBranchAssignmentScope,
} from '../users/user-governance.constants';

@Entity('user_branch_roles')
@Index(['user_id', 'branch_id', 'role_id'], { unique: true })
export class UserBranchRole {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => UserManagement, (user) => user.branchRoles, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: UserManagement;

    @Column({ name: 'user_id' })
    user_id: number;

    @ManyToOne(() => Branch, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'branch_id' })
    branch: Branch;

    @Column({ name: 'branch_id' })
    branch_id: number;

    @ManyToOne(() => Role, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'role_id' })
    roleEntity: Role;

    @Column({ name: 'role_id', nullable: true })
    role_id: number;

    @Column({
        name: 'assignment_scope',
        type: 'enum',
        enum: USER_BRANCH_ASSIGNMENT_SCOPES,
        nullable: true,
    })
    assignment_scope: UserBranchAssignmentScope | null;

    @Column({
        name: 'approval_authority',
        type: 'enum',
        enum: USER_APPROVAL_AUTHORITIES,
        nullable: true,
    })
    approval_authority: UserApprovalAuthority | null;

    @Column({ name: 'is_primary', type: 'boolean', default: false })
    is_primary: boolean;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
