import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { UserManagement } from '../../setup/entities/UserManagement.entity';
import { AccountingPayrollRun } from './payroll-run.entity';

export type AccountingPayrollRunLinePayoutStatus = 'unpaid' | 'partial' | 'paid';

@Entity('accounting_payroll_run_lines')
export class AccountingPayrollRunLine {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => AccountingPayrollRun, (run) => run.lines, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'payroll_run_id' })
    payroll_run: AccountingPayrollRun;

    @Column({ name: 'payroll_run_id', type: 'int' })
    payroll_run_id: number;

    @ManyToOne(() => UserManagement, { nullable: true })
    @JoinColumn({ name: 'user_id' })
    user: UserManagement | null;

    @Column({ name: 'user_id', type: 'int', nullable: true })
    user_id: number | null;

    @Column({ name: 'employee_id_snapshot', type: 'varchar', length: 50, nullable: true })
    employee_id_snapshot: string | null;

    @Column({ name: 'staff_name_snapshot', type: 'varchar', length: 180 })
    staff_name_snapshot: string;

    @Column({ name: 'employment_type_snapshot', type: 'varchar', length: 50, nullable: true })
    employment_type_snapshot: string | null;

    @Column({ name: 'salary_type', type: 'varchar', length: 50, nullable: true })
    salary_type: string | null;

    @Column({ name: 'salary_rate', type: 'decimal', precision: 15, scale: 2, default: 0 })
    salary_rate: number;

    @Column({ name: 'present_days', type: 'int', default: 0 })
    present_days: number;

    @Column({ name: 'late_days', type: 'int', default: 0 })
    late_days: number;

    @Column({ name: 'leave_days', type: 'int', default: 0 })
    leave_days: number;

    @Column({ name: 'absent_days', type: 'int', default: 0 })
    absent_days: number;

    @Column({ name: 'working_minutes', type: 'int', default: 0 })
    working_minutes: number;

    @Column({ name: 'payable_days', type: 'int', default: 0 })
    payable_days: number;

    @Column({ name: 'payable_units', type: 'decimal', precision: 10, scale: 2, default: 0 })
    payable_units: number;

    @Column({ name: 'base_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    base_amount: number;

    @Column({ name: 'gross_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    gross_amount: number;

    @Column({ name: 'attendance_deduction_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    attendance_deduction_amount: number;

    @Column({ name: 'advance_recovery_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    advance_recovery_amount: number;

    @Column({ name: 'loan_recovery_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    loan_recovery_amount: number;

    @Column({ name: 'income_tax_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    income_tax_amount: number;

    @Column({ name: 'eobi_employee_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    eobi_employee_amount: number;

    @Column({ name: 'eobi_employer_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    eobi_employer_amount: number;

    @Column({ name: 'social_security_employee_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    social_security_employee_amount: number;

    @Column({ name: 'social_security_employer_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    social_security_employer_amount: number;

    @Column({ name: 'employee_compliance_deduction_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    employee_compliance_deduction_amount: number;

    @Column({ name: 'employer_contribution_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    employer_contribution_amount: number;

    @Column({ name: 'deduction_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    deduction_amount: number;

    @Column({ name: 'arrears_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    arrears_amount: number;

    @Column({ name: 'net_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    net_amount: number;

    @Column({ name: 'paid_days', type: 'int', default: 0 })
    paid_days: number;

    @Column({ name: 'paid_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    paid_amount: number;

    @Column({ name: 'payable_balance', type: 'decimal', precision: 15, scale: 2, default: 0 })
    payable_balance: number;

    @Column({ name: 'payout_status', type: 'varchar', length: 20, default: 'unpaid' })
    payout_status: AccountingPayrollRunLinePayoutStatus;

    @Column({ name: 'paid_at', type: 'datetime', nullable: true })
    paid_at: Date | null;

    @Column({ name: 'paid_by', type: 'int', nullable: true })
    paid_by: number | null;
}
