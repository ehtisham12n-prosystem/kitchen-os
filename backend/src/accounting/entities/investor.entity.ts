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

export enum InvestorStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    SUSPENDED = 'suspended',
    CLOSED = 'closed',
}

@Entity('accounting_investors')
@Index(['client_id', 'investor_code'], { unique: true })
@Index(['client_id', 'full_name'])
export class AccountingInvestor {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Client)
    @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
    client: Client;

    @Column({ name: 'client_id', type: 'varchar', length: 20 })
    client_id: string;

    @Column({ name: 'investor_code', type: 'varchar', length: 40 })
    investor_code: string;

    @Column({ name: 'full_name', type: 'varchar', length: 150 })
    full_name: string;

    @Column({ name: 'phone', type: 'varchar', length: 50, nullable: true })
    phone: string | null;

    @Column({ name: 'email', type: 'varchar', length: 150, nullable: true })
    email: string | null;

    @Column({ name: 'address', type: 'text', nullable: true })
    address: string | null;

    @ManyToOne(() => Branch, { nullable: true })
    @JoinColumn({ name: 'primary_branch_id' })
    primary_branch: Branch | null;

    @Column({ name: 'primary_branch_id', type: 'int', nullable: true })
    primary_branch_id: number | null;

    @Column({
        name: 'status',
        type: 'enum',
        enum: InvestorStatus,
        default: InvestorStatus.ACTIVE,
    })
    status: InvestorStatus;

    @Column({ name: 'notes', type: 'text', nullable: true })
    notes: string | null;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}

