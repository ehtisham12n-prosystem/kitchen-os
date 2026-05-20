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
import { ChartOfAccount } from './chart-of-accounts.entity';
import { JournalEntry } from './journal-entry.entity';

export enum AccountingLoanInterestMethod {
    FLAT = 'flat',
    REDUCING = 'reducing',
}

export enum AccountingLoanRepaymentFrequency {
    MONTHLY = 'monthly',
    QUARTERLY = 'quarterly',
}

export enum AccountingLoanStatus {
    ACTIVE = 'active',
    COMPLETED = 'completed',
    DEFAULTED = 'defaulted',
    CLOSED = 'closed',
}

@Entity('accounting_loans')
@Index(['client_id', 'loan_code'], { unique: true })
@Index(['client_id', 'branch_id', 'status'])
export class AccountingLoan {
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

    @Column({ name: 'loan_code', type: 'varchar', length: 40 })
    loan_code: string;

    @Column({ name: 'source_name', type: 'varchar', length: 180 })
    source_name: string;

    @Column({ name: 'principal_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    principal_amount: number;

    @Column({ name: 'annual_interest_rate', type: 'decimal', precision: 7, scale: 4, default: 0 })
    annual_interest_rate: number;

    @Column({
        name: 'interest_method',
        type: 'enum',
        enum: AccountingLoanInterestMethod,
    })
    interest_method: AccountingLoanInterestMethod;

    @Column({ name: 'start_date', type: 'date' })
    start_date: string;

    @Column({ name: 'duration_months', type: 'int' })
    duration_months: number;

    @Column({
        name: 'repayment_frequency',
        type: 'enum',
        enum: AccountingLoanRepaymentFrequency,
        default: AccountingLoanRepaymentFrequency.MONTHLY,
    })
    repayment_frequency: AccountingLoanRepaymentFrequency;

    @Column({ name: 'installment_count', type: 'int' })
    installment_count: number;

    @Column({ name: 'installment_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    installment_amount: number;

    @Column({ name: 'maturity_date', type: 'date', nullable: true })
    maturity_date: string | null;

    @Column({ name: 'next_due_date', type: 'date', nullable: true })
    next_due_date: string | null;

    @Column({ name: 'outstanding_principal_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    outstanding_principal_amount: number;

    @Column({ name: 'total_paid_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    total_paid_amount: number;

    @Column({
        name: 'status',
        type: 'enum',
        enum: AccountingLoanStatus,
        default: AccountingLoanStatus.ACTIVE,
    })
    status: AccountingLoanStatus;

    @Column({ name: 'disbursement_reference_no', type: 'varchar', length: 100, nullable: true })
    disbursement_reference_no: string | null;

    @ManyToOne(() => ChartOfAccount, { nullable: true })
    @JoinColumn({ name: 'disbursement_account_id' })
    disbursement_account: ChartOfAccount | null;

    @Column({ name: 'disbursement_account_id', type: 'int', nullable: true })
    disbursement_account_id: number | null;

    @ManyToOne(() => ChartOfAccount, { nullable: true })
    @JoinColumn({ name: 'liability_account_id' })
    liability_account: ChartOfAccount | null;

    @Column({ name: 'liability_account_id', type: 'int', nullable: true })
    liability_account_id: number | null;

    @ManyToOne(() => ChartOfAccount, { nullable: true })
    @JoinColumn({ name: 'interest_expense_account_id' })
    interest_expense_account: ChartOfAccount | null;

    @Column({ name: 'interest_expense_account_id', type: 'int', nullable: true })
    interest_expense_account_id: number | null;

    @ManyToOne(() => JournalEntry, { nullable: true })
    @JoinColumn({ name: 'disbursement_journal_entry_id' })
    disbursement_journal_entry: JournalEntry | null;

    @Column({ name: 'disbursement_journal_entry_id', type: 'int', nullable: true })
    disbursement_journal_entry_id: number | null;

    @Column({ name: 'notes', type: 'text', nullable: true })
    notes: string | null;

    @Column({ name: 'created_by', type: 'int', nullable: true })
    created_by: number | null;

    @Column({ name: 'updated_by', type: 'int', nullable: true })
    updated_by: number | null;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
