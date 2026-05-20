import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Client } from '../../platform/entities/client.entity';

@Entity('tax_configurations')
@Index(['client_id', 'is_active'])
@Unique(['client_id', 'tax_code'])
export class TaxConfiguration {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @Column({ name: 'tax_name', type: 'varchar', length: 100 })
  tax_name: string;

  @Column({ name: 'tax_code', type: 'varchar', length: 50 })
  tax_code: string;

  @Column({ name: 'tax_registration_number', type: 'varchar', length: 100, nullable: true })
  tax_registration_number: string | null;

  @Column({
    name: 'calculation_method',
    type: 'enum',
    enum: ['percentage', 'fixed'],
    default: 'percentage',
  })
  calculation_method: 'percentage' | 'fixed';

  @Column({
    name: 'tax_rate',
    type: 'decimal',
    precision: 10,
    scale: 4,
    default: 0,
  })
  tax_rate: number;

  @Column({ name: 'payment_type_rates', type: 'json', nullable: true })
  payment_type_rates: Record<string, number> | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  is_default: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  is_active: boolean;

  @Column({ name: 'applies_to_dine_in', type: 'boolean', default: true })
  applies_to_dine_in: boolean;

  @Column({ name: 'applies_to_takeout', type: 'boolean', default: true })
  applies_to_takeout: boolean;

  @Column({ name: 'applies_to_delivery', type: 'boolean', default: true })
  applies_to_delivery: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

