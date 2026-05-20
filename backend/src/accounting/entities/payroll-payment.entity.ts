import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { Branch } from '../../setup/entities/branch.entity';
import { UserManagement } from '../../setup/entities/UserManagement.entity';
import { ChartOfAccount } from './chart-of-accounts.entity';
import { JournalEntry } from './journal-entry.entity';
import { AccountingPayrollRun } from './payroll-run.entity';
import { AccountingPayrollRunLine } from './payroll-run-line.entity';

@Entity('accounting_payroll_payments')
export class AccountingPayrollPayment {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => AccountingPayrollRun, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'payroll_run_id' })
    payroll_run: AccountingPayrollRun;

    @Column({ name: 'payroll_run_id', type: 'int' })
    payroll_run_id: number;

    @ManyToOne(() => AccountingPayrollRunLine, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'payroll_run_line_id' })
    payroll_run_line: AccountingPayrollRunLine;

    @Column({ name: 'payroll_run_line_id', type: 'int' })
    payroll_run_line_id: number;

    @ManyToOne(() => Branch)
    @JoinColumn({ name: 'branch_id' })
    branch: Branch;

    @Column({ name: 'branch_id', type: 'int' })
    branch_id: number;

    @ManyToOne(() => UserManagement, { nullable: true })
    @JoinColumn({ name: 'user_id' })
    user: UserManagement | null;

    @Column({ name: 'user_id', type: 'int', nullable: true })
    user_id: number | null;

    @Column({ name: 'client_id', type: 'varchar', length: 20 })
    client_id: string;

    @Column({ name: 'payment_date', type: 'date' })
    payment_date: string;

    @Column({ name: 'payment_method', type: 'varchar', length: 50 })
    payment_method: string;

    @ManyToOne(() => ChartOfAccount, { nullable: true })
    @JoinColumn({ name: 'treasury_account_id' })
    treasury_account: ChartOfAccount | null;

    @Column({ name: 'treasury_account_id', type: 'int', nullable: true })
    treasury_account_id: number | null;

    @Column({ name: 'amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    amount: number;

    @Column({ name: 'reference_no', type: 'varchar', length: 100, nullable: true })
    reference_no: string | null;

    @Column({ name: 'notes', type: 'text', nullable: true })
    notes: string | null;

    @ManyToOne(() => JournalEntry, { nullable: true })
    @JoinColumn({ name: 'journal_entry_id' })
    journal_entry: JournalEntry | null;

    @Column({ name: 'journal_entry_id', type: 'int', nullable: true })
    journal_entry_id: number | null;

    @Column({ name: 'created_by', type: 'int', nullable: true })
    created_by: number | null;

    @CreateDateColumn()
    created_at: Date;
}
