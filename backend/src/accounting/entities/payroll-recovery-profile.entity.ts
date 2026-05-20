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
import { Client } from '../../platform/entities/client.entity';
import { Branch } from '../../setup/entities/branch.entity';
import { UserManagement } from '../../setup/entities/UserManagement.entity';

@Entity('accounting_payroll_recovery_profiles')
@Index(['client_id', 'branch_id', 'user_id'], { unique: true })
export class AccountingPayrollRecoveryProfile {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Client)
    @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
    client: Client;

    @Column({ name: 'client_id', type: 'varchar', length: 20 })
    client_id: string;

    @ManyToOne(() => Branch)
    @JoinColumn({ name: 'branch_id' })
    branch: Branch;

    @Column({ name: 'branch_id', type: 'int' })
    branch_id: number;

    @ManyToOne(() => UserManagement)
    @JoinColumn({ name: 'user_id' })
    user: UserManagement;

    @Column({ name: 'user_id', type: 'int' })
    user_id: number;

    @Column({ name: 'advance_balance', type: 'decimal', precision: 15, scale: 2, default: 0 })
    advance_balance: number;

    @Column({ name: 'loan_balance', type: 'decimal', precision: 15, scale: 2, default: 0 })
    loan_balance: number;

    @Column({ name: 'default_advance_recovery', type: 'decimal', precision: 15, scale: 2, default: 0 })
    default_advance_recovery: number;

    @Column({ name: 'default_loan_recovery', type: 'decimal', precision: 15, scale: 2, default: 0 })
    default_loan_recovery: number;

    @Column({ name: 'notes', type: 'text', nullable: true })
    notes: string | null;

    @Column({ name: 'is_active', type: 'boolean', default: true })
    is_active: boolean;

    @Column({ name: 'updated_by', type: 'int', nullable: true })
    updated_by: number | null;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
