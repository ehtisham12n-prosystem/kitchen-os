import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Client } from './client.entity';
import { PlatformFeature } from './platform-feature.entity';

@Entity('client_feature_overrides')
@Unique('ux_client_feature_overrides_client_feature', ['client_id', 'feature_id'])
export class ClientFeatureOverride {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @ManyToOne(() => PlatformFeature, (feature) => feature.client_overrides)
  @JoinColumn({ name: 'feature_id' })
  feature: PlatformFeature;

  @Column({ name: 'feature_id', type: 'int' })
  feature_id: number;

  @Column({ name: 'is_enabled', default: true })
  is_enabled: boolean;

  @Column({ name: 'reason', length: 255 })
  reason: string;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'created_by', type: 'varchar', length: 255, nullable: true })
  created_by: string | null;

  @Column({ name: 'updated_by', type: 'varchar', length: 255, nullable: true })
  updated_by: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

