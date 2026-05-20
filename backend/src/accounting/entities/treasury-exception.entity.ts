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

export enum AccountingTreasuryExceptionStatus {
    OPEN = 'open',
    IN_REVIEW = 'in_review',
    RESOLVED = 'resolved',
    WAIVED = 'waived',
}

@Entity('accounting_treasury_exceptions')
@Index(['client_id', 'branch_id', 'exception_type', 'exception_key'], { unique: true })
@Index(['client_id', 'branch_id', 'status'])
export class AccountingTreasuryException {
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

    @Column({ name: 'exception_type', type: 'varchar', length: 50 })
    exception_type: string;

    @Column({ name: 'exception_key', type: 'varchar', length: 120 })
    exception_key: string;

    @Column({
        name: 'status',
        type: 'enum',
        enum: AccountingTreasuryExceptionStatus,
        default: AccountingTreasuryExceptionStatus.OPEN,
    })
    status: AccountingTreasuryExceptionStatus;

    @Column({ name: 'owner_name', type: 'varchar', length: 120, nullable: true })
    owner_name: string | null;

    @Column({ name: 'notes', type: 'varchar', length: 1000, nullable: true })
    notes: string | null;

    @Column({ name: 'updated_by', type: 'varchar', length: 120, nullable: true })
    updated_by: string | null;

    @Column({ name: 'resolved_at', type: 'datetime', nullable: true })
    resolved_at: Date | null;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
