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
import { Client } from '../../platform/entities/client.entity';
import { Category } from './category.entity';
import { PriceProfile } from './price-profile.entity';
import { CuisineType } from './cuisine-type.entity';
import { Station } from './station.entity';
import { Uom } from './uom.entity';
import { TaxConfiguration } from '../../setup/entities/tax-configuration.entity';

@Entity('products')
@Index(['client_id', 'category_id']) // Standard fetch index
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column({ name: 'category_id', nullable: true })
  category_id: number;

  @Column({ name: 'product_name', length: 150 })
  product_name: string;

  @Column({ name: 'product_description', type: 'text', nullable: true })
  product_description: string;

  @Column({ name: 'product_image_url', length: 255, nullable: true })
  product_image_url: string;

  @Column({ name: 'product_sku', length: 100, nullable: true })
  product_sku: string; // Stock Keeping Unit

  @Column({
    name: 'product_base_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  product_base_price: number;

  @Column({ name: 'serving_time', type: 'int', nullable: true, default: 20 })
  serving_time: number | null;

  @Column({ name: 'product_is_configurable', type: 'boolean', default: false })
  product_is_configurable: boolean; // Does it have sizes/toppings?

  @ManyToOne(() => CuisineType, { nullable: true })
  @JoinColumn({ name: 'cuisine_type_id' })
  cuisine_type: CuisineType;

  @Column({ name: 'cuisine_type_id', nullable: true })
  cuisine_type_id: number;

  @ManyToOne(() => PriceProfile, { nullable: true })
  @JoinColumn({ name: 'price_profile_id' })
  price_profile_entity: PriceProfile | null;

  @Column({ name: 'price_profile_id', nullable: true })
  price_profile_id: number | null;

  @ManyToOne(() => Station, { nullable: true })
  @JoinColumn({ name: 'production_station_id' })
  production_station: Station;

  @Column({ name: 'production_station_id', nullable: true })
  production_station_id: number;

  @ManyToOne(() => Uom, { nullable: true })
  @JoinColumn({ name: 'base_uom_id' })
  base_uom: Uom;

  @Column({ name: 'base_uom_id', nullable: true })
  base_uom_id: number;

  @ManyToOne(() => TaxConfiguration, { nullable: true })
  @JoinColumn({ name: 'tax_configuration_id' })
  tax_configuration: TaxConfiguration | null;

  @Column({ name: 'tax_configuration_id', type: 'int', nullable: true })
  tax_configuration_id: number | null;

  @Column({ name: 'product_code', length: 100, nullable: true })
  product_code: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  is_active: boolean;

  @Column({ name: 'is_branch_active', type: 'boolean', default: true })
  is_branch_active: boolean;

  @Column({ name: 'allow_open_order_return', type: 'boolean', default: false })
  allow_open_order_return: boolean;

  @Column({
    name: 'distribution_scope',
    type: 'enum',
    enum: ['all', 'selected'],
    default: 'all',
  })
  distribution_scope: 'all' | 'selected';

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

