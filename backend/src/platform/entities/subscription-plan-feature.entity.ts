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
import { SubscriptionPlan } from './subscription-plan.entity';
import { PlatformFeature } from './platform-feature.entity';

@Entity('subscription_plan_features')
@Unique('ux_subscription_plan_features_plan_feature', ['plan_id', 'feature_id'])
export class SubscriptionPlanFeature {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SubscriptionPlan)
  @JoinColumn({ name: 'plan_id' })
  plan: SubscriptionPlan;

  @Column({ name: 'plan_id', type: 'int' })
  plan_id: number;

  @ManyToOne(() => PlatformFeature, (feature) => feature.plan_features)
  @JoinColumn({ name: 'feature_id' })
  feature: PlatformFeature;

  @Column({ name: 'feature_id', type: 'int' })
  feature_id: number;

  @Column({ name: 'is_enabled', default: true })
  is_enabled: boolean;

  @Column({ name: 'created_by', type: 'varchar', length: 255, nullable: true })
  created_by: string | null;

  @Column({ name: 'updated_by', type: 'varchar', length: 255, nullable: true })
  updated_by: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
