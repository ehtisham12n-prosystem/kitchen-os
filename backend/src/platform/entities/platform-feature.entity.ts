import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SubscriptionPlanFeature } from './subscription-plan-feature.entity';
import { ClientFeatureOverride } from './client-feature-override.entity';

@Entity('platform_features')
export class PlatformFeature {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'feature_key', length: 50, unique: true })
  feature_key: string;

  @Column({ name: 'feature_name', length: 120 })
  feature_name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_active', default: true })
  is_active: boolean;

  @Column({ name: 'created_by', type: 'varchar', length: 255, nullable: true })
  created_by: string | null;

  @Column({ name: 'updated_by', type: 'varchar', length: 255, nullable: true })
  updated_by: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => SubscriptionPlanFeature, (planFeature) => planFeature.feature)
  plan_features: SubscriptionPlanFeature[];

  @OneToMany(() => ClientFeatureOverride, (override) => override.feature)
  client_overrides: ClientFeatureOverride[];
}
