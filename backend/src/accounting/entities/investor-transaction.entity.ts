import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { Client } from '../../platform/entities/client.entity';
import { Branch } from '../../setup/entities/branch.entity';
import { AccountingInvestorAgreement } from './investor-agreement.entity';
import { AccountingInvestor } from './investor.entity';
import { AccountingProfitDistributionBatch } from './profit-distribution-batch.entity';

export enum InvestorTransactionType {
    CAPITAL_INJECTION = 'capital_injection',
    CAPITAL_WITHDRAWAL = 'capital_withdrawal',
    CAPITAL_RETURN = 'capital_return',
    MANUAL_INCREASE = 'manual_increase',
    MANUAL_DECREASE = 'manual_decrease',
    PROFIT_DISTRIBUTION = 'profit_distribution',
    MANAGEMENT_CHARGE = 'management_charge',
}

@Entity('accounting_investor_transactions')
@Index(['client_id', 'branch_id', 'transaction_date'])
@Index(['client_id', 'investor_id', 'transaction_date'])
@Index(['client_id', 'agreement_id', 'transaction_date'])
export class AccountingInvestorTransaction {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Client)
    @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
    client: Client;

    @Column({ name: 'client_id', type: 'varchar', length: 20 })
    client_id: string;

    @ManyToOne(() => AccountingInvestor)
    @JoinColumn({ name: 'investor_id' })
    investor: AccountingInvestor;

    @Column({ name: 'investor_id', type: 'int' })
    investor_id: number;

    @ManyToOne(() => AccountingInvestorAgreement)
    @JoinColumn({ name: 'agreement_id' })
    agreement: AccountingInvestorAgreement;

    @Column({ name: 'agreement_id', type: 'int' })
    agreement_id: number;

    @ManyToOne(() => Branch)
    @JoinColumn({ name: 'branch_id' })
    branch: Branch;

    @Column({ name: 'branch_id', type: 'int' })
    branch_id: number;

    @ManyToOne(() => AccountingProfitDistributionBatch, { nullable: true })
    @JoinColumn({ name: 'distribution_batch_id' })
    distribution_batch: AccountingProfitDistributionBatch | null;

    @Column({ name: 'distribution_batch_id', type: 'int', nullable: true })
    distribution_batch_id: number | null;

    @Column({ name: 'transaction_date', type: 'date' })
    transaction_date: string;

    @Column({
        name: 'transaction_type',
        type: 'enum',
        enum: InvestorTransactionType,
    })
    transaction_type: InvestorTransactionType;

    @Column({ name: 'amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    amount: number;

    @Column({ name: 'description', type: 'varchar', length: 255, nullable: true })
    description: string | null;

    @Column({ name: 'reference_no', type: 'varchar', length: 100, nullable: true })
    reference_no: string | null;

    @Column({ name: 'period_start', type: 'date', nullable: true })
    period_start: string | null;

    @Column({ name: 'period_end', type: 'date', nullable: true })
    period_end: string | null;

    @Column({ name: 'created_by_user_id', type: 'int', nullable: true })
    created_by_user_id: number | null;

    @Column({ name: 'created_by_name', type: 'varchar', length: 150, nullable: true })
    created_by_name: string | null;

    @CreateDateColumn()
    created_at: Date;
}

