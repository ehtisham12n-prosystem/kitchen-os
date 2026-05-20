import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
    Index,
} from 'typeorm';
import { Client } from '../../platform/entities/client.entity';
import { Branch } from '../../setup/entities/branch.entity';

@Entity('accounting_coa')
@Index(['client_id', 'account_code'], { unique: true })
export class ChartOfAccount {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Client)
    @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
    client: Client;

    @Column({ name: 'client_id', type: 'varchar', length: 20 })
    client_id: string;

    @Column({ name: 'account_code', length: 20 })
    account_code: string; // e.g., "1001", "4000"

    @Column({ name: 'account_name', length: 150 })
    account_name: string; // e.g., "Cash on Hand", "Sales Revenue"

    @Column({ name: 'bank_name', type: 'varchar', length: 150, nullable: true })
    bank_name: string | null;

    @Column({ name: 'treasury_institution_name', type: 'varchar', length: 150, nullable: true })
    treasury_institution_name: string | null;

    @Column({ name: 'account_title', type: 'varchar', length: 150, nullable: true })
    account_title: string | null;

    @Column({ name: 'treasury_account_title', type: 'varchar', length: 150, nullable: true })
    treasury_account_title: string | null;

    @Column({ name: 'account_number_iban', type: 'varchar', length: 60, nullable: true })
    account_number_iban: string | null;

    @Column({ name: 'treasury_reference_no_iban', type: 'varchar', length: 60, nullable: true })
    treasury_reference_no_iban: string | null;

    @Column({ name: 'currency_code', type: 'varchar', length: 10, nullable: true })
    currency_code: string | null;

    @Column({ name: 'treasury_currency_code', type: 'varchar', length: 10, nullable: true })
    treasury_currency_code: string | null;

    @Column({ name: 'bank_account_type', type: 'varchar', length: 20, nullable: true })
    bank_account_type: string | null;

    @Column({ name: 'treasury_account_type', type: 'varchar', length: 20, nullable: true })
    treasury_account_type: string | null;

    @Column({
        name: 'account_type',
        type: 'enum',
        enum: ['asset', 'liability', 'equity', 'revenue', 'expense'],
    })
    account_type: string;

    @ManyToOne(() => ChartOfAccount, (account) => account.children, { nullable: true })
    @JoinColumn({ name: 'parent_id' })
    parent?: ChartOfAccount | null;

    @Column({ name: 'parent_id', type: 'int', nullable: true })
    parent_id?: number | null;

    @OneToMany(() => ChartOfAccount, (account) => account.parent)
    children?: ChartOfAccount[];

    @ManyToOne(() => Branch, { nullable: true })
    @JoinColumn({ name: 'branch_id' })
    branch?: Branch | null;

    @Column({ name: 'branch_id', type: 'int', nullable: true })
    branch_id?: number | null;

    @Column({
        name: 'scope',
        type: 'enum',
        enum: ['company', 'branch'],
        default: 'company',
    })
    scope: 'company' | 'branch';

    @Column({ name: 'is_active', type: 'boolean', default: true })
    is_active: boolean;

    @Column({ name: 'description', type: 'varchar', length: 1000, nullable: true })
    description: string | null;

    @Column({ name: 'usage_guidance', type: 'varchar', length: 1500, nullable: true })
    usage_guidance: string | null;

    @Column({ name: 'example_entry', type: 'varchar', length: 500, nullable: true })
    example_entry: string | null;

    @Column({ name: 'confusion_note', type: 'varchar', length: 500, nullable: true })
    confusion_note: string | null;

    @Column({ name: 'schedule_code', type: 'varchar', length: 30, nullable: true })
    schedule_code: string | null;

    @Column({ name: 'is_control_account', type: 'boolean', default: false })
    is_control_account: boolean;

    @Column({ name: 'allow_manual_posting', type: 'boolean', default: true })
    allow_manual_posting: boolean;

    @Column({ name: 'is_bank_account', type: 'boolean', default: false })
    is_bank_account: boolean;

    @Column({ name: 'is_cash_account', type: 'boolean', default: false })
    is_cash_account: boolean;

    @Column({ name: 'is_petty_cash_account', type: 'boolean', default: false })
    is_petty_cash_account: boolean;

    @Column({ name: 'is_system', type: 'boolean', default: false })
    is_system: boolean;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}

