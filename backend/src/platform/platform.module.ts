import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from './entities/client.entity';
import { UserManagement } from '../setup/entities/UserManagement.entity';
import { AuthAudit } from '../auth/entities/auth-audit.entity';
import { AuthSession } from '../auth/entities/auth-session.entity';
import { AuthAccessLog } from '../auth/entities/auth-access-log.entity';
import { Role } from '../setup/entities/Roles.entity';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { ClientOnboarding } from './entities/client-onboarding.entity';
import { ClientSettings } from './entities/client-settings.entity';
import { PlatformSettings } from './entities/platform-settings.entity';

import { SubscriptionOrder } from './entities/subscription-order.entity';
import { ClientSubscription } from './entities/client-subscription.entity';
import { ClientSubscriptionHistory } from './entities/client-subscription-history.entity';
import { Branch } from '../setup/entities/branch.entity';
import { PermissionModule } from './entities/permission-module.entity';
import { PermissionPage } from './entities/permission-page.entity';
import { Departments } from '../setup/entities/Departments.entity';
import { Designation } from '../setup/entities/Designation.entity';
import { PermissionBlueprint } from './entities/permission-blueprint.entity';
import { Announcement } from './entities/announcement.entity';
import { SupportTicket, TicketMessage } from './entities/support-ticket.entity';
import { AuditLog } from './entities/audit-log.entity';

import { RegistryModule } from './security/registry/registry.module';
import { RegistryService } from './security/registry/registry.service';
import { CommunicationModule } from './communication/communication.module';
import { AnnouncementsService } from './communication/announcements/announcements.service';
import { SupportService } from './communication/support/support.service';
import { AuditModule } from './audit/audit.module';
import { AuditService } from './audit/audit.service';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { BlueprintsModule } from './blueprints/blueprints.module';
import { SupportWorkspaceModule } from './support-workspace/support-workspace.module';
import { StructuredLoggerService } from './common/services/structured-logger.service';

import { PlatformService } from './platform.service';
import { PlatformController } from './platform.controller';
import { SetupModule } from '../setup/setup.module';
import { ThemesModule } from './themes/themes.module';
import { ClientsModule } from './clients/clients.module';
import { SysGroupsModule } from './security/sys-groups/sys-groups.module';
import { SysGroupsService } from './security/sys-groups/sys-groups.service';
import { SystemGroup } from './security/sys-groups/entities/system-group.entity';

import { PlatformDashboardService } from './dashboard/dashboard.service';
import { PlatformDashboardController } from './dashboard/dashboard.controller';
import { OnModuleInit } from '@nestjs/common';
import { OperationalReliabilityService } from './reliability/operational-reliability.service';
import { SecurityAdminService } from './security/security-admin.service';
import { SecurityAdminController } from './security/security-admin.controller';
import { PlatformBootstrapService } from './platform-bootstrap.service';
import { ClientSettingsController } from './client-settings.controller';
import { CatalogModule } from '../catalog/catalog.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PosModule } from '../pos/pos.module';
import { TaxConfiguration } from '../setup/entities/tax-configuration.entity';
import { SaleCounter } from '../pos/entities/sale-counter.entity';
import { Category } from '../catalog/entities/category.entity';
import { PriceProfile } from '../catalog/entities/price-profile.entity';
import { Station } from '../catalog/entities/station.entity';
import { Uom } from '../catalog/entities/uom.entity';
import { Product } from '../catalog/entities/product.entity';
import { InventoryClass } from '../inventory/entities/inventory-class.entity';
import { InventoryType } from '../inventory/entities/inventory-type.entity';
import { InventorySubType } from '../inventory/entities/inventory-sub-type.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { BranchInventory } from '../inventory/entities/branch-inventory.entity';
import { StockLevel } from '../inventory-op/entities/stock-level.entity';

@Module({
  imports: [
    SetupModule,
    CatalogModule,
    InventoryModule,
    PosModule,
    ThemesModule,
    ClientsModule,
    SysGroupsModule,
    RegistryModule,
    CommunicationModule,
    AuditModule,
    EntitlementsModule,
    OnboardingModule,
    BlueprintsModule,
    SupportWorkspaceModule,
    TypeOrmModule.forFeature([
      Client,
      UserManagement,
      AuthAudit,
      AuthSession,
      AuthAccessLog,
      Role,
      SubscriptionPlan,
      ClientOnboarding,
      ClientSettings,
      PlatformSettings,
      SubscriptionOrder,
      ClientSubscription,
      ClientSubscriptionHistory,
      Branch,
      PermissionModule,
      PermissionPage,
      PermissionBlueprint,
      Announcement,
      SupportTicket,
      TicketMessage,
      AuditLog,
      Departments,
      Designation,
      SystemGroup,
      TaxConfiguration,
      SaleCounter,
      Category,
      PriceProfile,
      Station,
      Uom,
      Product,
      InventoryClass,
      InventoryType,
      InventorySubType,
      InventoryItem,
      BranchInventory,
      StockLevel,
    ]),
  ],
  controllers: [
    PlatformController,
    ClientSettingsController,
    PlatformDashboardController,
    SecurityAdminController,
  ],
  providers: [
    PlatformService,
    PlatformBootstrapService,
    PlatformDashboardService,
    SecurityAdminService,
    OperationalReliabilityService,
    StructuredLoggerService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
  exports: [
    PlatformService,
    PlatformBootstrapService,
    PlatformDashboardService,
    OperationalReliabilityService,
    StructuredLoggerService,
    SysGroupsModule,
    ClientsModule,
  ],
})
export class PlatformModule implements OnModuleInit {
  constructor(private readonly platformService: PlatformService) { }

  async onModuleInit() {
    console.log('[PlatformModule] Auto-seeding temporarily disabled.');
    // await this.platformService.seedNexusClient();
    // await this.platformService.seedLookups();
  }
}
