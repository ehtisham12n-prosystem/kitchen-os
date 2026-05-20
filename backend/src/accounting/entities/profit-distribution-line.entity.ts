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

@Entity('accounting_profit_distribution_lines')
@Index(['client_id', 'batch_id'])
@Index(['client_id', 'agreement_id'])
export class AccountingProfitDistributionLine {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Client)
    @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
    client: Client;

    @Column({ name: 'client_id', type: 'varchar', length: 20 })
    client_id: string;

    @ManyToOne(() => AccountingProfitDistributionBatch)
    @JoinColumn({ name: 'batch_id' })
    batch: AccountingProfitDistributionBatch;

    @Column({ name: 'batch_id', type: 'int' })
    batch_id: number;

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

    @Column({ name: 'capital_basis_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    capital_basis_amount: number;

    @Column({ name: 'profit_share_percent', type: 'decimal', precision: 7, scale: 4, default: 0 })
    profit_share_percent: number;

    @Column({ name: 'fixed_return_percent', type: 'decimal', precision: 7, scale: 4, default: 0 })
    fixed_return_percent: number;

    @Column({ name: 'management_charge_percent', type: 'decimal', precision: 7, scale: 4, default: 0 })
    management_charge_percent: number;

    @Column({ name: 'profit_share_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    profit_share_amount: number;

    @Column({ name: 'fixed_return_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    fixed_return_amount: number;

    @Column({ name: 'gross_distribution_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    gross_distribution_amount: number;

    @Column({ name: 'management_charge_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    management_charge_amount: number;

    @Column({ name: 'net_distribution_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    net_distribution_amount: number;

    @CreateDateColumn()
    created_at: Date;
}

