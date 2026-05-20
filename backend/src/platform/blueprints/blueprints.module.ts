import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { SetupModule } from '../../setup/setup.module';
import { Blueprint } from '../entities/blueprint.entity';
import { BlueprintVersion } from '../entities/blueprint-version.entity';
import { ClientBlueprintAssignment } from '../entities/client-blueprint-assignment.entity';
import { BlueprintApplicationLog } from '../entities/blueprint-application-log.entity';
import { Client } from '../entities/client.entity';
import { ClientSettings } from '../entities/client-settings.entity';
import { ClientOnboarding } from '../entities/client-onboarding.entity';
import { ClientOnboardingEvent } from '../entities/client-onboarding-event.entity';
import { Role } from '../../setup/entities/Roles.entity';
import { Departments } from '../../setup/entities/Departments.entity';
import { Designation } from '../../setup/entities/Designation.entity';
import { ChartOfAccount } from '../../accounting/entities/chart-of-accounts.entity';
import { Category } from '../../catalog/entities/category.entity';
import { PriceProfile } from '../../catalog/entities/price-profile.entity';
import { CuisineType } from '../../catalog/entities/cuisine-type.entity';
import { Station } from '../../catalog/entities/station.entity';
import { Uom } from '../../catalog/entities/uom.entity';
import { BlueprintsController } from './blueprints.controller';
import { BlueprintsService } from './blueprints.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Blueprint,
      BlueprintVersion,
      ClientBlueprintAssignment,
      BlueprintApplicationLog,
      Client,
      ClientSettings,
      ClientOnboarding,
      ClientOnboardingEvent,
      Role,
      Departments,
      Designation,
      ChartOfAccount,
      Category,
      PriceProfile,
      CuisineType,
      Station,
      Uom,
    ]),
    AuditModule,
    SetupModule,
  ],
  controllers: [BlueprintsController],
  providers: [BlueprintsService],
  exports: [BlueprintsService],
})
export class BlueprintsModule {}
