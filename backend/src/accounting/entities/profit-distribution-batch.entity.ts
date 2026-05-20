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
import { InvestorAgreementFrequency } from './investor-agreement.entity';

export enum ProfitDistributionBatchStatus {
    PROCESSED = 'processed',
}

@Entity('accounting_profit_distribution_batches')
@Index(['client_id', 'branch_id', 'distribution_frequency', 'period_start', 'period_end'], { unique: true })
export class AccountingProfitDistributionBatch {
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

    @Column({ name: 'batch_code', type: 'varchar', length: 40, nullable: true })
    batch_code: string | null;

    @Column({
        name: 'distribution_frequency',
        type: 'enum',
        enum: InvestorAgreementFrequency,
    })
    distribution_frequency: InvestorAgreementFrequency;

    @Column({ name: 'period_start', type: 'date' })
    period_start: string;

    @Column({ name: 'period_end', type: 'date' })
    period_end: string;

    @Column({ name: 'net_profit_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    net_profit_amount: number;

    @Column({ name: 'positive_profit_basis_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    positive_profit_basis_amount: number;

    @Column({ name: 'total_management_charge_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    total_management_charge_amount: number;

    @Column({ name: 'total_distribution_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    total_distribution_amount: number;

    @Column({
        name: 'status',
        type: 'enum',
        enum: ProfitDistributionBatchStatus,
        default: ProfitDistributionBatchStatus.PROCESSED,
    })
    status: ProfitDistributionBatchStatus;

    @Column({ name: 'processed_at', type: 'datetime', nullable: true })
    processed_at: Date | null;

    @Column({ name: 'processed_by_user_id', type: 'int', nullable: true })
    processed_by_user_id: number | null;

    @Column({ name: 'processed_by_name', type: 'varchar', length: 150, nullable: true })
    processed_by_name: string | null;

    @Column({ name: 'notes', type: 'text', nullable: true })
    notes: string | null;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}

