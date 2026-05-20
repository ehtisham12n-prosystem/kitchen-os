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
import { AccountingInvestor } from './investor.entity';

export enum InvestorAgreementType {
    PROFIT_SHARE = 'profit_share',
    FIXED_RETURN = 'fixed_return',
    HYBRID = 'hybrid',
}

export enum InvestorAgreementFrequency {
    MONTHLY = 'monthly',
    QUARTERLY = 'quarterly',
}

export enum InvestorAgreementStatus {
    DRAFT = 'draft',
    ACTIVE = 'active',
    MATURED = 'matured',
    CLOSED = 'closed',
}

@Entity('accounting_investor_agreements')
@Index(['client_id', 'agreement_code'], { unique: true })
@Index(['client_id', 'branch_id', 'status'])
@Index(['client_id', 'investor_id', 'branch_id'])
export class AccountingInvestorAgreement {
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

    @ManyToOne(() => Branch)
    @JoinColumn({ name: 'branch_id' })
    branch: Branch;

    @Column({ name: 'branch_id', type: 'int' })
    branch_id: number;

    @Column({ name: 'agreement_code', type: 'varchar', length: 40 })
    agreement_code: string;

    @Column({ name: 'agreement_name', type: 'varchar', length: 150 })
    agreement_name: string;

    @Column({
        name: 'agreement_type',
        type: 'enum',
        enum: InvestorAgreementType,
    })
    agreement_type: InvestorAgreementType;

    @Column({
        name: 'distribution_frequency',
        type: 'enum',
        enum: InvestorAgreementFrequency,
        default: InvestorAgreementFrequency.MONTHLY,
    })
    distribution_frequency: InvestorAgreementFrequency;

    @Column({ name: 'capital_commitment_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    capital_commitment_amount: number;

    @Column({ name: 'current_capital_balance', type: 'decimal', precision: 15, scale: 2, default: 0 })
    current_capital_balance: number;

    @Column({ name: 'profit_share_percent', type: 'decimal', precision: 7, scale: 4, default: 0 })
    profit_share_percent: number;

    @Column({ name: 'fixed_return_percent', type: 'decimal', precision: 7, scale: 4, default: 0 })
    fixed_return_percent: number;

    @Column({ name: 'management_charge_percent', type: 'decimal', precision: 7, scale: 4, default: 0 })
    management_charge_percent: number;

    @Column({ name: 'total_distributed_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    total_distributed_amount: number;

    @Column({ name: 'effective_from', type: 'date' })
    effective_from: string;

    @Column({ name: 'effective_to', type: 'date', nullable: true })
    effective_to: string | null;

    @Column({
        name: 'status',
        type: 'enum',
        enum: InvestorAgreementStatus,
        default: InvestorAgreementStatus.DRAFT,
    })
    status: InvestorAgreementStatus;

    @Column({ name: 'notes', type: 'text', nullable: true })
    notes: string | null;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}

