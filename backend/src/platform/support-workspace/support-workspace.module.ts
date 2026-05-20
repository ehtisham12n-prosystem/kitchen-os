import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuditLog } from '../entities/audit-log.entity';
import { BlueprintApplicationLog } from '../entities/blueprint-application-log.entity';
import { ClientBlueprintAssignment } from '../entities/client-blueprint-assignment.entity';
import { ClientOnboardingStep } from '../entities/client-onboarding-step.entity';
import { Branch } from '../../setup/entities/branch.entity';
import { UserManagement } from '../../setup/entities/UserManagement.entity';
import { PosDevice } from '../../pos/entities/pos-device.entity';
import { PosSyncEvent } from '../../pos/entities/pos-sync-event.entity';
import { BlueprintsModule } from '../blueprints/blueprints.module';
import { ClientsModule } from '../clients/clients.module';
import { ClientOnboarding } from '../entities/client-onboarding.entity';
import { ClientSubscription } from '../entities/client-subscription.entity';
import { Client } from '../entities/client.entity';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { SupportWorkspaceController } from './support-workspace.controller';
import { SupportWorkspaceService } from './support-workspace.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Client,
      ClientSubscription,
      ClientOnboarding,
      ClientOnboardingStep,
      ClientBlueprintAssignment,
      BlueprintApplicationLog,
      Branch,
      UserManagement,
      PosDevice,
      PosSyncEvent,
      AuditLog,
    ]),
    ClientsModule,
    OnboardingModule,
    EntitlementsModule,
    BlueprintsModule,
    AuditModule,
  ],
  controllers: [SupportWorkspaceController],
  providers: [SupportWorkspaceService],
  exports: [SupportWorkspaceService],
})
export class SupportWorkspaceModule {}
