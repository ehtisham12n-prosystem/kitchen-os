import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { Client } from '../../platform/entities/client.entity';
import { Branch } from '../../setup/entities/branch.entity';
import { ChartOfAccount } from './chart-of-accounts.entity';
import { JournalEntry } from './journal-entry.entity';
import { AccountingFixedAssetItem } from './fixed-asset-item.entity';
import { AccountingFixedAssetMovement } from './fixed-asset-movement.entity';

export enum FixedAssetCondition {
    WORKING = 'working',
    SERVICE_REQUIRED = 'service_required',
    DAMAGED = 'damaged',
}

export enum FixedAssetOperationalStatus {
    ASSIGNED = 'assigned',
    IN_STORE = 'in_store',
    UNDER_REPAIR = 'under_repair',
    STOLEN = 'stolen',
    LOST = 'lost',
    DISPOSED = 'disposed',
}

export enum FixedAssetPurchaseCondition {
    NEW = 'new',
    OPEN_BOX = 'open_box',
    USED_WORKING = 'used_working',
    USED_EXCELLENT = 'used_excellent',
    USED_GOOD = 'used_good',
    USED_FAIR = 'used_fair',
    USED_POOR = 'used_poor',
    REFURBISHED = 'refurbished',
}

export enum FixedAssetDisposalMethod {
    AUCTIONED = 'auctioned',
    SOLD = 'sold',
    DONATED = 'donated',
    SCRAPPED = 'scrapped',
    TRANSFERRED = 'transferred',
    WRITTEN_OFF = 'written_off',
}

export enum FixedAssetCapitalizationMode {
    CASH = 'cash',
    BANK = 'bank',
    CREDIT_PURCHASE = 'credit_purchase',
}

@Entity('accounting_fixed_asset_units')
@Index(['client_id', 'asset_item_id', 'unit_number'], { unique: true })
@Index(['client_id', 'tag_no'], { unique: true })
export class AccountingFixedAssetUnit {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Client)
    @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
    client: Client;

    @Column({ name: 'client_id', type: 'varchar', length: 20 })
    client_id: string;

    @ManyToOne(() => AccountingFixedAssetItem, (item) => item.units)
    @JoinColumn({ name: 'asset_item_id' })
    asset_item: AccountingFixedAssetItem;

    @Column({ name: 'asset_item_id', type: 'int' })
    asset_item_id: number;

    @Column({ name: 'unit_number', type: 'int' })
    unit_number: number;

    @ManyToOne(() => Branch)
    @JoinColumn({ name: 'branch_id' })
    branch: Branch;

    @Column({ name: 'branch_id', type: 'int' })
    branch_id: number;

    @Column({ name: 'model', type: 'varchar', length: 150, nullable: true })
    model: string | null;

    @Column({ name: 'manufacturer', type: 'varchar', length: 150, nullable: true })
    manufacturer: string | null;

    @Column({ name: 'description', type: 'varchar', length: 500, nullable: true })
    description: string | null;

    @Column({ name: 'serial_no', type: 'varchar', length: 120, nullable: true })
    serial_no: string | null;

    @Column({ name: 'tag_no', type: 'varchar', length: 120 })
    tag_no: string;

    @Column({ name: 'purchase_price', type: 'decimal', precision: 15, scale: 2, default: 0 })
    purchase_price: number;

    @Column({ name: 'annual_depreciation_rate', type: 'decimal', precision: 7, scale: 2, nullable: true })
    annual_depreciation_rate: number | null;

    @Column({
        name: 'purchase_condition',
        type: 'enum',
        enum: FixedAssetPurchaseCondition,
        default: FixedAssetPurchaseCondition.NEW,
    })
    purchase_condition: FixedAssetPurchaseCondition;

    @Column({ name: 'capitalization_date', type: 'date' })
    capitalization_date: string;

    @Column({ name: 'purchase_order_no', type: 'varchar', length: 100, nullable: true })
    purchase_order_no: string | null;

    @Column({ name: 'invoice_no', type: 'varchar', length: 100, nullable: true })
    invoice_no: string | null;

    @Column({ name: 'supplier_name', type: 'varchar', length: 150, nullable: true })
    supplier_name: string | null;

    @Column({
        name: 'capitalization_mode',
        type: 'enum',
        enum: FixedAssetCapitalizationMode,
        default: FixedAssetCapitalizationMode.CREDIT_PURCHASE,
    })
    capitalization_mode: FixedAssetCapitalizationMode;

    @ManyToOne(() => ChartOfAccount, { nullable: true })
    @JoinColumn({ name: 'treasury_account_id' })
    treasury_account: ChartOfAccount | null;

    @Column({ name: 'treasury_account_id', type: 'int', nullable: true })
    treasury_account_id: number | null;

    @Column({ name: 'physical_location', type: 'varchar', length: 180, nullable: true })
    physical_location: string | null;

    @Column({ name: 'issued_to', type: 'varchar', length: 150, nullable: true })
    issued_to: string | null;

    @Column({ name: 'custodian_id', type: 'varchar', length: 80, nullable: true })
    custodian_id: string | null;

    @Column({ name: 'issued_date', type: 'date', nullable: true })
    issued_date: string | null;

    @Column({ name: 'expected_return', type: 'date', nullable: true })
    expected_return: string | null;

    @Column({
        name: 'condition',
        type: 'enum',
        enum: FixedAssetCondition,
        default: FixedAssetCondition.WORKING,
    })
    condition: FixedAssetCondition;

    @Column({
        name: 'operational_status',
        type: 'enum',
        enum: FixedAssetOperationalStatus,
        default: FixedAssetOperationalStatus.IN_STORE,
    })
    operational_status: FixedAssetOperationalStatus;

    @Column({ name: 'warranty_expiry', type: 'date', nullable: true })
    warranty_expiry: string | null;

    @Column({ name: 'last_service_date', type: 'date', nullable: true })
    last_service_date: string | null;

    @Column({ name: 'next_service_due', type: 'date', nullable: true })
    next_service_due: string | null;

    @Column({ name: 'insurance_expiry', type: 'date', nullable: true })
    insurance_expiry: string | null;

    @Column({ name: 'disposal_no', type: 'varchar', length: 60, nullable: true })
    disposal_no: string | null;

    @Column({
        name: 'disposal_method',
        type: 'enum',
        enum: FixedAssetDisposalMethod,
        nullable: true,
    })
    disposal_method: FixedAssetDisposalMethod | null;

    @Column({ name: 'disposal_date', type: 'date', nullable: true })
    disposal_date: string | null;

    @Column({ name: 'disposal_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    disposal_amount: number;

    @Column({ name: 'disposal_recipient', type: 'varchar', length: 180, nullable: true })
    disposal_recipient: string | null;

    @Column({ name: 'disposal_note', type: 'varchar', length: 1000, nullable: true })
    disposal_note: string | null;

    @Column({ name: 'disposal_approved_by', type: 'varchar', length: 150, nullable: true })
    disposal_approved_by: string | null;

    @Column({ name: 'disposal_reason_code', type: 'varchar', length: 80, nullable: true })
    disposal_reason_code: string | null;

    @Column({ name: 'comments', type: 'varchar', length: 1000, nullable: true })
    comments: string | null;

    @ManyToOne(() => JournalEntry, { nullable: true })
    @JoinColumn({ name: 'capitalization_journal_entry_id' })
    capitalization_journal_entry: JournalEntry | null;

    @Column({ name: 'capitalization_journal_entry_id', type: 'int', nullable: true })
    capitalization_journal_entry_id: number | null;

    @ManyToOne(() => JournalEntry, { nullable: true })
    @JoinColumn({ name: 'disposal_journal_entry_id' })
    disposal_journal_entry: JournalEntry | null;

    @Column({ name: 'disposal_journal_entry_id', type: 'int', nullable: true })
    disposal_journal_entry_id: number | null;

    @OneToMany(() => AccountingFixedAssetMovement, (movement) => movement.asset_unit)
    movements: AccountingFixedAssetMovement[];

    @Column({ name: 'created_by', type: 'varchar', length: 100, nullable: true })
    created_by: string | null;

    @Column({ name: 'created_by_name', type: 'varchar', length: 150, nullable: true })
    created_by_name: string | null;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
