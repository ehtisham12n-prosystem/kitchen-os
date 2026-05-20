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
import { BRANCH_INVENTORY_STORE_TYPES } from '../branches/branch-control.types';
import type {
  BranchDocumentSettings,
  BranchInventoryControlSettings,
  BranchOperatingHours,
  BranchOperationalSettings,
  BranchTaxSettings,
} from '../branches/branch-config.types';

@Entity('branches')
@Index(['client_id', 'id']) // Multi-tenant index
@Index(['client_id', 'branch_code'], { unique: true })
export class Branch {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @Column({ length: 50 })
  branch_code: string;

  @Column({ name: 'branch_name', length: 150 })
  branch_name: string;

  @Column({ name: 'short_name', type: 'varchar', length: 50, nullable: true })
  short_name: string;

  @Column({ name: 'branch_address', type: 'text', nullable: true })
  address: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  contact_person: string;

  @Column({ name: 'branch_tax_region', type: 'varchar', length: 50, nullable: true })
  tax_region: string;

  @Column({ name: 'currency_code', length: 10, default: 'USD' })
  currency_code: string;

  @Column({ name: 'date_format', type: 'varchar', length: 30, default: 'MMM DD, YYYY' })
  date_format: string;

  @Column({ name: 'time_format', type: 'varchar', length: 30, default: 'hh:mma' })
  time_format: string;

  @Column({ length: 10, default: 'en' })
  language: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  theme_id: string;

  @Column({ name: 'inherit_client_currency', type: 'boolean', default: true })
  inherit_client_currency: boolean;

  @Column({ name: 'inherit_client_language', type: 'boolean', default: true })
  inherit_client_language: boolean;

  @Column({ name: 'inherit_client_theme', type: 'boolean', default: true })
  inherit_client_theme: boolean;

  @Column({
    name: 'inventory_store_type',
    type: 'enum',
    enum: BRANCH_INVENTORY_STORE_TYPES,
    default: 'branch',
  })
  inventory_store_type: 'branch' | 'central';

  @Column({ name: 'is_production_source', type: 'boolean', default: false })
  is_production_source: boolean;

  @Column({ name: 'production_source_label', type: 'varchar', length: 100, nullable: true })
  production_source_label: string | null;

  @Column({ type: 'simple-array', nullable: true })
  modules_enabled: string[];

  @Column({ name: 'opening_time', type: 'time', nullable: true })
  opening_time: string;

  @Column({ name: 'closing_time', type: 'time', nullable: true })
  closing_time: string;

  @Column({ name: 'operating_hours', type: 'json', nullable: true })
  operating_hours: BranchOperatingHours | null;

  @Column({ name: 'document_settings', type: 'json', nullable: true })
  document_settings: BranchDocumentSettings | null;

  @Column({ name: 'tax_settings', type: 'json', nullable: true })
  tax_settings: BranchTaxSettings | null;

  @Column({ name: 'operational_settings', type: 'json', nullable: true })
  operational_settings: BranchOperationalSettings | null;

  @Column({ name: 'inventory_control_settings', type: 'json', nullable: true })
  inventory_control_settings: BranchInventoryControlSettings | null;

  @Column({
    type: 'enum',
    enum: ['setup_pending', 'active', 'inactive', 'suspended'],
    default: 'setup_pending',
  })
  status: string;

  // Keeping is_active for backward compatibility if needed by older queries temporarily, but mapping via getter/setter or just replacing
  // The spec says "status: Active / Inactive / Suspended", so let's stick to status.
  @Column({ name: 'is_active', type: 'boolean', default: true })
  is_active: boolean;

  @Column({ name: 'branch_phone', type: 'varchar', length: 50, nullable: true })
  phone: string;

  @Column({ name: 'branch_email', type: 'varchar', length: 150, nullable: true })
  email: string;

  @Column({ type: 'int', nullable: true })
  max_UserManagements: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  created_by: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  updated_by: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

