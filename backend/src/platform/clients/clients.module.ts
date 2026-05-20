import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { Client } from '../entities/client.entity';
import { Branch } from '../../setup/entities/branch.entity';
import { SetupModule } from '../../setup/setup.module';
import { ClientContact } from '../entities/client-contact.entity';
import { ClientStatusHistory } from '../entities/client-status-history.entity';
import { UserManagement } from '../../setup/entities/UserManagement.entity';
import { UserBranchRole } from '../../setup/entities/user-branch-role.entity';
import { AuditModule } from '../audit/audit.module';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import { ClientSubscription } from '../entities/client-subscription.entity';
import { ClientSubscriptionHistory } from '../entities/client-subscription-history.entity';
import { ClientOnboarding } from '../entities/client-onboarding.entity';
import { ClientGovernanceHistory } from '../entities/client-governance-history.entity';
import { ClientSettings } from '../entities/client-settings.entity';
import { ClientGovernanceService } from './client-governance.service';
import { PlatformSettings } from '../entities/platform-settings.entity';
import { Blueprint } from '../entities/blueprint.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Client,
      Branch,
      ClientContact,
      ClientStatusHistory,
      UserManagement,
      UserBranchRole,
      SubscriptionPlan,
      ClientSubscription,
      ClientSubscriptionHistory,
      ClientOnboarding,
      ClientGovernanceHistory,
      ClientSettings,
      PlatformSettings,
      Blueprint,
    ]),
    forwardRef(() => SetupModule),
    AuditModule,
  ],
  controllers: [ClientsController],
  providers: [ClientsService, ClientGovernanceService],
  exports: [ClientsService, ClientGovernanceService]
})
export class ClientsModule { }

