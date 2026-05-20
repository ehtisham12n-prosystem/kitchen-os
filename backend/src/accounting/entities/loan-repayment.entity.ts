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
import { AccountingLoan } from './loan.entity';

export enum AccountingLoanRepaymentStatus {
    DUE = 'due',
    PAID = 'paid',
    OVERDUE = 'overdue',
}

@Entity('accounting_loan_repayments')
@Index(['client_id', 'loan_id', 'installment_no'], { unique: true })
@Index(['client_id', 'branch_id', 'due_date'])
export class AccountingLoanRepayment {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Client)
    @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
    client: Client;

    @Column({ name: 'client_id', type: 'varchar', length: 20 })
    client_id: string;

    @ManyToOne(() => AccountingLoan, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'loan_id' })
    loan: AccountingLoan;

    @Column({ name: 'loan_id', type: 'int' })
    loan_id: number;

    @ManyToOne(() => Branch)
    @JoinColumn({ name: 'branch_id' })
    branch: Branch;

    @Column({ name: 'branch_id', type: 'int' })
    branch_id: number;

    @Column({ name: 'installment_no', type: 'int' })
    installment_no: number;

    @Column({ name: 'due_date', type: 'date' })
    due_date: string;

    @Column({ name: 'principal_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    principal_amount: number;

    @Column({ name: 'interest_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    interest_amount: number;

    @Column({ name: 'total_due_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    total_due_amount: number;

    @Column({ name: 'principal_paid_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    principal_paid_amount: number;

    @Column({ name: 'interest_paid_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    interest_paid_amount: number;

    @Column({ name: 'paid_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    paid_amount: number;

    @Column({ name: 'paid_date', type: 'date', nullable: true })
    paid_date: string | null;

    @Column({ name: 'balance_after_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    balance_after_amount: number;

    @Column({
        name: 'status',
        type: 'enum',
        enum: AccountingLoanRepaymentStatus,
        default: AccountingLoanRepaymentStatus.DUE,
    })
    status: AccountingLoanRepaymentStatus;

    @Column({ name: 'payment_method', type: 'varchar', length: 50, nullable: true })
    payment_method: string | null;

    @ManyToOne(() => ChartOfAccount, { nullable: true })
    @JoinColumn({ name: 'treasury_account_id' })
    treasury_account: ChartOfAccount | null;

    @Column({ name: 'treasury_account_id', type: 'int', nullable: true })
    treasury_account_id: number | null;

    @ManyToOne(() => JournalEntry, { nullable: true })
    @JoinColumn({ name: 'journal_entry_id' })
    journal_entry: JournalEntry | null;

    @Column({ name: 'journal_entry_id', type: 'int', nullable: true })
    journal_entry_id: number | null;

    @Column({ name: 'reference_no', type: 'varchar', length: 100, nullable: true })
    reference_no: string | null;

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
