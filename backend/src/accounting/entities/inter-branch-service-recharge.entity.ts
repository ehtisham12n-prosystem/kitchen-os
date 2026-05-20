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

export enum AccountingInterBranchServiceType {
    CENTRAL_ADMIN = 'central_admin',
    LOGISTICS = 'logistics',
    KITCHEN_SUPPORT = 'kitchen_support',
    SHARED_SUPPORT = 'shared_support',
    OTHER = 'other',
}

@Entity('accounting_inter_branch_service_recharges')
@Index(['client_id', 'recharge_no'], { unique: true })
export class AccountingInterBranchServiceRecharge {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Client)
    @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
    client: Client;

    @Column({ name: 'client_id', type: 'varchar', length: 20 })
    client_id: string;

    @Column({ name: 'recharge_no', type: 'varchar', length: 40 })
    recharge_no: string;

    @ManyToOne(() => Branch)
    @JoinColumn({ name: 'source_branch_id' })
    source_branch: Branch;

    @Column({ name: 'source_branch_id', type: 'int' })
    source_branch_id: number;

    @ManyToOne(() => Branch)
    @JoinColumn({ name: 'destination_branch_id' })
    destination_branch: Branch;

    @Column({ name: 'destination_branch_id', type: 'int' })
    destination_branch_id: number;

    @Column({
        name: 'service_type',
        type: 'enum',
        enum: AccountingInterBranchServiceType,
    })
    service_type: AccountingInterBranchServiceType;

    @Column({ name: 'description', type: 'varchar', length: 255 })
    description: string;

    @Column({ name: 'notes', type: 'varchar', length: 1000, nullable: true })
    notes: string | null;

    @Column({ name: 'service_date', type: 'date' })
    service_date: string;

    @Column({ name: 'amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    amount: number;

    @Column({ name: 'source_journal_id', type: 'int', nullable: true })
    source_journal_id: number | null;

    @Column({ name: 'destination_journal_id', type: 'int', nullable: true })
    destination_journal_id: number | null;

    @Column({ name: 'created_by', type: 'varchar', length: 100, nullable: true })
    created_by: string | null;

    @Column({ name: 'created_by_name', type: 'varchar', length: 150, nullable: true })
    created_by_name: string | null;

    @CreateDateColumn()
    created_at: Date;
}
