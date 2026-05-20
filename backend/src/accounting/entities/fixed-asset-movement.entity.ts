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
import { JournalEntry } from './journal-entry.entity';
import { AccountingFixedAssetUnit } from './fixed-asset-unit.entity';

export enum FixedAssetMovementType {
    ACQUISITION = 'acquisition',
    ISSUE = 'issue',
    RETURN = 'return',
    TRANSFER = 'transfer',
    DISPOSAL = 'disposal',
}

@Entity('accounting_fixed_asset_movements')
@Index(['client_id', 'asset_unit_id', 'movement_date'])
export class AccountingFixedAssetMovement {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Client)
    @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
    client: Client;

    @Column({ name: 'client_id', type: 'varchar', length: 20 })
    client_id: string;

    @ManyToOne(() => AccountingFixedAssetUnit, (unit) => unit.movements)
    @JoinColumn({ name: 'asset_unit_id' })
    asset_unit: AccountingFixedAssetUnit;

    @Column({ name: 'asset_unit_id', type: 'int' })
    asset_unit_id: number;

    @Column({
        name: 'movement_type',
        type: 'enum',
        enum: FixedAssetMovementType,
    })
    movement_type: FixedAssetMovementType;

    @Column({ name: 'movement_date', type: 'date' })
    movement_date: string;

    @ManyToOne(() => Branch, { nullable: true })
    @JoinColumn({ name: 'from_branch_id' })
    from_branch: Branch | null;

    @Column({ name: 'from_branch_id', type: 'int', nullable: true })
    from_branch_id: number | null;

    @ManyToOne(() => Branch, { nullable: true })
    @JoinColumn({ name: 'to_branch_id' })
    to_branch: Branch | null;

    @Column({ name: 'to_branch_id', type: 'int', nullable: true })
    to_branch_id: number | null;

    @Column({ name: 'from_location', type: 'varchar', length: 180, nullable: true })
    from_location: string | null;

    @Column({ name: 'to_location', type: 'varchar', length: 180, nullable: true })
    to_location: string | null;

    @Column({ name: 'from_custodian', type: 'varchar', length: 150, nullable: true })
    from_custodian: string | null;

    @Column({ name: 'to_custodian', type: 'varchar', length: 150, nullable: true })
    to_custodian: string | null;

    @Column({ name: 'reference_no', type: 'varchar', length: 100, nullable: true })
    reference_no: string | null;

    @Column({ name: 'authorized_by', type: 'varchar', length: 150, nullable: true })
    authorized_by: string | null;

    @Column({ name: 'received_by', type: 'varchar', length: 150, nullable: true })
    received_by: string | null;

    @Column({ name: 'vehicle_no', type: 'varchar', length: 80, nullable: true })
    vehicle_no: string | null;

    @Column({ name: 'gate_pass_no', type: 'varchar', length: 80, nullable: true })
    gate_pass_no: string | null;

    @Column({ name: 'notes', type: 'varchar', length: 1000, nullable: true })
    notes: string | null;

    @ManyToOne(() => JournalEntry, { nullable: true })
    @JoinColumn({ name: 'journal_entry_id' })
    journal_entry: JournalEntry | null;

    @Column({ name: 'journal_entry_id', type: 'int', nullable: true })
    journal_entry_id: number | null;

    @Column({ name: 'created_by', type: 'varchar', length: 100, nullable: true })
    created_by: string | null;

    @Column({ name: 'created_by_name', type: 'varchar', length: 150, nullable: true })
    created_by_name: string | null;

    @CreateDateColumn()
    created_at: Date;
}
