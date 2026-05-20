import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { Client } from '../../platform/entities/client.entity';
import { Branch } from '../../setup/entities/branch.entity';
import { ChartOfAccount } from './chart-of-accounts.entity';
import { JournalEntry } from './journal-entry.entity';
import { AccountingPayrollRunLine } from './payroll-run-line.entity';

export enum AccountingPayrollRunStatus {
    DRAFT = 'draft',
    APPROVED = 'approved',
    PARTIALLY_PAID = 'partially_paid',
    PAID = 'paid',
    VOID = 'void',
}

@Entity('accounting_payroll_runs')
@Index('idx_accounting_payroll_runs_scope', ['client_id', 'branch_id', 'period_start', 'period_end'])
export class AccountingPayrollRun {
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

    @Column({ name: 'run_no', type: 'varchar', length: 60 })
    run_no: string;

    @Column({ name: 'title', type: 'varchar', length: 180, nullable: true })
    title: string | null;

    @Column({ name: 'period_start', type: 'date' })
    period_start: string;

    @Column({ name: 'period_end', type: 'date' })
    period_end: string;

    @Column({ name: 'pay_date', type: 'date' })
    pay_date: string;

    @Column({
        name: 'status',
        type: 'enum',
        enum: AccountingPayrollRunStatus,
        default: AccountingPayrollRunStatus.DRAFT,
    })
    status: AccountingPayrollRunStatus;

    @Column({ name: 'employee_count', type: 'int', default: 0 })
    employee_count: number;

    @Column({ name: 'total_base_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    total_base_amount: number;

    @Column({ name: 'total_gross_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    total_gross_amount: number;

    @Column({ name: 'total_attendance_deduction_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    total_attendance_deduction_amount: number;

    @Column({ name: 'total_advance_recovery_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    total_advance_recovery_amount: number;

    @Column({ name: 'total_loan_recovery_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    total_loan_recovery_amount: number;

    @Column({ name: 'total_income_tax_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    total_income_tax_amount: number;

    @Column({ name: 'total_eobi_employee_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    total_eobi_employee_amount: number;

    @Column({ name: 'total_eobi_employer_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    total_eobi_employer_amount: number;

    @Column({ name: 'total_social_security_employee_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    total_social_security_employee_amount: number;

    @Column({ name: 'total_social_security_employer_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    total_social_security_employer_amount: number;

    @Column({ name: 'total_employee_compliance_deduction_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    total_employee_compliance_deduction_amount: number;

    @Column({ name: 'total_employer_contribution_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    total_employer_contribution_amount: number;

    @Column({ name: 'total_deduction_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    total_deduction_amount: number;

    @Column({ name: 'total_net_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    total_net_amount: number;

    @Column({ name: 'total_paid_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    total_paid_amount: number;

    @Column({ name: 'total_payable_balance', type: 'decimal', precision: 15, scale: 2, default: 0 })
    total_payable_balance: number;

    @Column({ name: 'notes', type: 'text', nullable: true })
    notes: string | null;

    @Column({ name: 'payment_method', type: 'varchar', length: 50, nullable: true })
    payment_method: string | null;

    @Column({ name: 'payment_reference_no', type: 'varchar', length: 100, nullable: true })
    payment_reference_no: string | null;

    @ManyToOne(() => ChartOfAccount, { nullable: true })
    @JoinColumn({ name: 'treasury_account_id' })
    treasury_account: ChartOfAccount | null;

    @Column({ name: 'treasury_account_id', type: 'int', nullable: true })
    treasury_account_id: number | null;

    @ManyToOne(() => JournalEntry, { nullable: true })
    @JoinColumn({ name: 'accrual_journal_entry_id' })
    accrual_journal_entry: JournalEntry | null;

    @Column({ name: 'accrual_journal_entry_id', type: 'int', nullable: true })
    accrual_journal_entry_id: number | null;

    @ManyToOne(() => JournalEntry, { nullable: true })
    @JoinColumn({ name: 'payment_journal_entry_id' })
    payment_journal_entry: JournalEntry | null;

    @Column({ name: 'payment_journal_entry_id', type: 'int', nullable: true })
    payment_journal_entry_id: number | null;

    @ManyToOne(() => JournalEntry, { nullable: true })
    @JoinColumn({ name: 'reversal_journal_entry_id' })
    reversal_journal_entry: JournalEntry | null;

    @Column({ name: 'reversal_journal_entry_id', type: 'int', nullable: true })
    reversal_journal_entry_id: number | null;

    @Column({ name: 'approved_at', type: 'datetime', nullable: true })
    approved_at: Date | null;

    @Column({ name: 'approved_by', type: 'int', nullable: true })
    approved_by: number | null;

    @Column({ name: 'paid_at', type: 'datetime', nullable: true })
    paid_at: Date | null;

    @Column({ name: 'paid_by', type: 'int', nullable: true })
    paid_by: number | null;

    @Column({ name: 'voided_at', type: 'datetime', nullable: true })
    voided_at: Date | null;

    @Column({ name: 'voided_by', type: 'int', nullable: true })
    voided_by: number | null;

    @Column({ name: 'created_by', type: 'int', nullable: true })
    created_by: number | null;

    @OneToMany(() => AccountingPayrollRunLine, (line) => line.payroll_run, { cascade: true })
    lines: AccountingPayrollRunLine[];

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
