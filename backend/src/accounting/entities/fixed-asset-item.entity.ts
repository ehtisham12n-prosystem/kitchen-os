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
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { AccountingFixedAssetUnit } from './fixed-asset-unit.entity';

export enum FixedAssetDepreciationMethod {
    STRAIGHT_LINE = 'straight_line',
}

@Entity('accounting_fixed_asset_items')
@Index(['client_id', 'asset_item_no'], { unique: true })
export class AccountingFixedAssetItem {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Client)
    @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
    client: Client;

    @Column({ name: 'client_id', type: 'varchar', length: 20 })
    client_id: string;

    @Column({ name: 'asset_item_no', type: 'varchar', length: 40 })
    asset_item_no: string;

    @Column({ name: 'name', type: 'varchar', length: 150 })
    name: string;

    @ManyToOne(() => InventoryItem, { nullable: true })
    @JoinColumn({ name: 'inventory_item_id' })
    inventory_item: InventoryItem | null;

    @Column({ name: 'inventory_item_id', type: 'int', nullable: true })
    inventory_item_id: number | null;

    @Column({ name: 'brand', type: 'varchar', length: 120, nullable: true })
    brand: string | null;

    @Column({ name: 'category', type: 'varchar', length: 120 })
    category: string;

    @Column({ name: 'sub_category', type: 'varchar', length: 120, nullable: true })
    sub_category: string | null;

    @Column({
        name: 'depreciation_method',
        type: 'enum',
        enum: FixedAssetDepreciationMethod,
        default: FixedAssetDepreciationMethod.STRAIGHT_LINE,
    })
    depreciation_method: FixedAssetDepreciationMethod;

    @Column({ name: 'useful_life_months', type: 'int', default: 36 })
    useful_life_months: number;

    @Column({ name: 'salvage_value', type: 'decimal', precision: 15, scale: 2, default: 0 })
    salvage_value: number;

    @Column({ name: 'notes', type: 'varchar', length: 1000, nullable: true })
    notes: string | null;

    @Column({ name: 'created_by', type: 'varchar', length: 100, nullable: true })
    created_by: string | null;

    @Column({ name: 'created_by_name', type: 'varchar', length: 150, nullable: true })
    created_by_name: string | null;

    @OneToMany(() => AccountingFixedAssetUnit, (unit) => unit.asset_item)
    units: AccountingFixedAssetUnit[];

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
