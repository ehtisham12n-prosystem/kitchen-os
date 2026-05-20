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
import { Branch } from '../../setup/entities/branch.entity';
import { Client } from '../../platform/entities/client.entity';

export enum AccountingPayrollComplianceFilingStatus {
    FILED = 'filed',
    VOID = 'void',
}

@Entity('accounting_payroll_compliance_filings')
@Index(['client_id', 'branch_id', 'period_start', 'period_end'])
export class AccountingPayrollComplianceFiling {
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

    @Column({ name: 'period_start', type: 'date' })
    period_start: string;

    @Column({ name: 'period_end', type: 'date' })
    period_end: string;

    @Column({ name: 'filing_date', type: 'date' })
    filing_date: string;

    @Column({ name: 'withholding_tax_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    withholding_tax_amount: number;

    @Column({ name: 'eobi_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    eobi_amount: number;

    @Column({ name: 'social_security_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    social_security_amount: number;

    @Column({ name: 'total_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    total_amount: number;

    @Column({ name: 'filing_reference', type: 'varchar', length: 120 })
    filing_reference: string;

    @Column({ name: 'note', type: 'text', nullable: true })
    note: string | null;

    @Column({
        name: 'status',
        type: 'enum',
        enum: AccountingPayrollComplianceFilingStatus,
        default: AccountingPayrollComplianceFilingStatus.FILED,
    })
    status: AccountingPayrollComplianceFilingStatus;

    @Column({ name: 'created_by', type: 'int', nullable: true })
    created_by: number | null;

    @Column({ name: 'voided_at', type: 'datetime', nullable: true })
    voided_at: Date | null;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
