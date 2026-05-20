import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Branch } from './entities/branch.entity';
import { Role } from './entities/Roles.entity';
import { UserManagement } from './entities/UserManagement.entity';
import { Floor } from './entities/floor.entity';
import { KitchenTableEntity } from './entities/table.entity';
import { Departments } from './entities/Departments.entity';
import { Designation } from './entities/Designation.entity';
import { UserBranchRole } from './entities/user-branch-role.entity';
import { UserBranchPermission } from './entities/user-branch-permission.entity';
import { Client } from '../platform/entities/client.entity';
import { ClientSettings } from '../platform/entities/client-settings.entity';
import { BranchCharge } from './entities/branch-charge.entity';
import { BranchLocation } from './entities/branch-location.entity';
import { TaxConfiguration } from './entities/tax-configuration.entity';
import { PaymentMethod } from './entities/payment-method.entity';
import { AttendanceLog } from './entities/attendance-log.entity';
import { AttendanceLock } from './entities/attendance-lock.entity';
import { Permission } from './entities/permission.entity';
import { RolePermission } from './entities/role-permission.entity';
import { UserRole } from './entities/user-role.entity';

import { RegistryModule } from '../platform/security/registry/registry.module';
import { DepartmentsController } from './departments/departments.controller';
import { DepartmentsService } from './departments/departments.service';
import { DesignationsController } from './designations/designations.controller';
import { DesignationsService } from './designations/designations.service';
import { UserManagementsController } from './users/users.controller';
import { UserManagementsService } from './users/users.service';
import { RolesController } from './roles/roles.controller';
import { RolesService } from './roles/roles.service';
import { BranchesController } from './branches/branches.controller';
import { BranchesService } from './branches/branches.service';
import { DiningLayoutService } from './layout/dining-layout.service';
import { AuditModule } from '../platform/audit/audit.module';
import { EntitlementsModule } from '../platform/entitlements/entitlements.module';
import { TaxesController } from './taxes/taxes.controller';
import { TaxesService } from './taxes/taxes.service';
import { PaymentMethodsController } from './payment-methods/payment-methods.controller';
import { PaymentMethodsService } from './payment-methods/payment-methods.service';
import { AttendanceController } from './attendance/attendance.controller';
import { AttendanceService } from './attendance/attendance.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Branch,
      Role,
      UserManagement,
      Floor,
      KitchenTableEntity,
      Client,
      ClientSettings,
      Departments,
      Designation,
      UserBranchRole,
      UserBranchPermission,
      BranchCharge,
      BranchLocation,
      TaxConfiguration,
      PaymentMethod,
      AttendanceLog,
      AttendanceLock,
      Permission,
      RolePermission,
      UserRole,
    ]),
    AuditModule,
    EntitlementsModule,
    RegistryModule,
  ],
  controllers: [
    DepartmentsController,
    DesignationsController,
    UserManagementsController,
    RolesController,
    BranchesController,
    TaxesController,
    PaymentMethodsController,
    AttendanceController,
  ],
  providers: [
    DepartmentsService,
    DesignationsService,
    UserManagementsService,
    RolesService,
    BranchesService,
    DiningLayoutService,
    TaxesService,
    PaymentMethodsService,
    AttendanceService,
  ],
  exports: [
    DepartmentsService,
    DesignationsService,
    UserManagementsService,
    RolesService,
    BranchesService,
    DiningLayoutService,
    TaxesService,
    PaymentMethodsService,
    AttendanceService,
  ],
})
export class SetupModule { }
