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

/**
 * ADR-03 Master Data Inheritance
 * This table governs how individual branches override the global client definitions.
 */
@Entity('branch_product_mapping')
@Index(['branch_id', 'product_id', 'price_profile_id'], { unique: true })
export class BranchProductMapping {
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

  @Column({ name: 'is_enabled', type: 'boolean', default: true })
  is_enabled: boolean; // Set to false to hide this item at this specific branch

  @Column({
    name: 'price_override',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  price_override: number; // If not null, branch uses this price instead of product_base_price

  @ManyToOne(() => PriceProfile, { nullable: true })
  @JoinColumn({ name: 'price_profile_id' })
  price_profile: PriceProfile | null;

    @Column({ name: 'price_profile_id', type: 'int', nullable: true })
    price_profile_id: number | null;

  @Column({ name: 'channel_availability', type: 'json', nullable: true })
  channel_availability: Record<string, boolean> | null;

  @Column({ name: 'temporarily_disabled_until', type: 'datetime', nullable: true })
  temporarily_disabled_until: Date | null;

  @Column({ name: 'temporary_disable_reason', type: 'varchar', length: 255, nullable: true })
  temporary_disable_reason: string | null;

  @Column({ name: 'allow_open_order_return', type: 'boolean', nullable: true })
  allow_open_order_return: boolean | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
