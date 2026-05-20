import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Branch } from '../../setup/entities/branch.entity';
import { UserManagement } from '../../setup/entities/UserManagement.entity';
import { PosDevice } from '../../pos/entities/pos-device.entity';
import { AuditModule } from '../audit/audit.module';
import { Client } from '../entities/client.entity';
import { ClientFeatureOverride } from '../entities/client-feature-override.entity';
import { ClientLimitOverride } from '../entities/client-limit-override.entity';
import { ClientSubscription } from '../entities/client-subscription.entity';
import { PlatformFeature } from '../entities/platform-feature.entity';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import { SubscriptionPlanFeature } from '../entities/subscription-plan-feature.entity';
import { EntitlementsController } from './entitlements.controller';
import { EntitlementsService } from './entitlements.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlatformFeature,
      SubscriptionPlanFeature,
      ClientFeatureOverride,
      ClientLimitOverride,
      SubscriptionPlan,
      ClientSubscription,
      Client,
      Branch,
      UserManagement,
      PosDevice,
    ]),
    AuditModule,
  ],
  controllers: [EntitlementsController],
  providers: [EntitlementsService],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}
