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

@Entity('user_branch_permissions')
@Index(['user_id', 'branch_id', 'permission_id'], { unique: true })
export class UserBranchPermission {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => UserManagement, (user) => user.branchPermissions, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: UserManagement;

    @Column({ name: 'user_id' })
    user_id: number;

    @ManyToOne(() => Branch, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'branch_id' })
    branch: Branch;

    @Column({ name: 'branch_id' })
    branch_id: number;

    @Column({ name: 'permission_id', length: 150 })
    permission_id: string; // e.g. "pos:void_item"

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
