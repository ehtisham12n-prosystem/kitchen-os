import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SetupModule } from '../../setup/setup.module';
import { AuditModule } from '../audit/audit.module';
import { Client } from '../entities/client.entity';
import { ClientContact } from '../entities/client-contact.entity';
import { ClientBlueprintAssignment } from '../entities/client-blueprint-assignment.entity';
import { ClientLimitOverride } from '../entities/client-limit-override.entity';
import { ClientOnboarding } from '../entities/client-onboarding.entity';
import { ClientOnboardingEvent } from '../entities/client-onboarding-event.entity';
import { ClientOnboardingStep } from '../entities/client-onboarding-step.entity';
import { ClientStatusHistory } from '../entities/client-status-history.entity';
import { ClientSubscription } from '../entities/client-subscription.entity';
import { Blueprint } from '../entities/blueprint.entity';
import { BlueprintVersion } from '../entities/blueprint-version.entity';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import { Role } from '../../setup/entities/Roles.entity';
import { UserManagement } from '../../setup/entities/UserManagement.entity';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Client,
      ClientBlueprintAssignment,
      ClientContact,
      ClientLimitOverride,
      ClientOnboarding,
      ClientOnboardingEvent,
      ClientOnboardingStep,
      ClientStatusHistory,
      ClientSubscription,
      Blueprint,
      BlueprintVersion,
      Role,
      SubscriptionPlan,
      UserManagement,
    ]),
    SetupModule,
    AuditModule,
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
