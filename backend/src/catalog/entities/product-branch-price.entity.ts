import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Branch } from '../../setup/entities/branch.entity';
import { Product } from './product.entity';
import { PriceProfile } from './price-profile.entity';
import { ProductCustomization } from './product-customization.entity';
import { Station } from './station.entity';

@Entity('product_branch_prices')
@Index(['branch_id', 'product_id', 'price_profile_id', 'customization_id'], { unique: true })
export class ProductBranchPrice {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Branch)
    @JoinColumn({ name: 'branch_id' })
    branch: Branch;

    @Column({ name: 'branch_id' })
    branch_id: number;

    @ManyToOne(() => Product)
    @JoinColumn({ name: 'product_id' })
    product: Product;

    @Column({ name: 'product_id' })
    product_id: number;

    @ManyToOne(() => PriceProfile)
    @JoinColumn({ name: 'price_profile_id' })
    price_profile: PriceProfile;

    @Column({ name: 'price_profile_id' })
    price_profile_id: number;

    @ManyToOne(() => ProductCustomization, { nullable: true })
    @JoinColumn({ name: 'customization_id' })
    customization: ProductCustomization;

    @Column({ name: 'customization_id', nullable: true })
    customization_id: number;

    @Column({
        name: 'price',
        type: 'decimal',
        precision: 10,
        scale: 2,
        default: 0,
    })
    price: number;

    @ManyToOne(() => Station, { nullable: true })
    @JoinColumn({ name: 'station_id' })
    station: Station;

    @Column({ name: 'station_id', nullable: true })
    station_id: number;

    @Column({ name: 'effective_from', type: 'date', nullable: true })
    effective_from: string | null;

    @Column({ name: 'delivery_minutes', type: 'int', nullable: true })
    delivery_minutes: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
