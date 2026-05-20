import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './config/typeorm.config';
import { PlatformModule } from './platform/platform.module';
import { AuthModule } from './auth/auth.module';

import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { BranchAccessGuard } from './auth/guards/branch-access.guard';
import { SubscriptionGuard } from './auth/guards/subscription.guard';
import { TenantGovernanceGuard } from './auth/guards/tenant-governance.guard';
import { SetupModule } from './setup/setup.module';
import { CatalogModule } from './catalog/catalog.module';
import { InventoryModule } from './inventory/inventory.module';
import { PosModule } from './pos/pos.module';
import { RecipeModule } from './recipe/recipe.module';
import { InventoryOpModule } from './inventory-op/inventory-op.module';
import { VendorModule } from './vendor/vendor.module';
import { AccountingModule } from './accounting/accounting.module';
import { ProductionModule } from './production/production.module';
import { CustomersModule } from './customers/customers.module';
import { DealsModule } from './deals/deals.module';
import { AiModule } from './ai/ai.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { OrderTypeModule } from './master-data/order-type/order-type.module';
import { CateringModule } from './catering/catering.module';
import { RequestLoggingInterceptor } from './platform/common/interceptors/request-logging.interceptor';
import { GlobalExceptionFilter } from './platform/common/filters/global-exception.filter';
import { StructuredLoggerService } from './platform/common/services/structured-logger.service';
import { randomUUID } from 'crypto';
import { EntitlementsModule } from './platform/entitlements/entitlements.module';
import { ApprovalsModule } from './approvals/approvals.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(typeOrmConfig),
    PlatformModule,
    AuthModule,
    SetupModule,
    CatalogModule,
    InventoryModule,
    PosModule,
    RecipeModule,
    InventoryOpModule,
    VendorModule,
    AccountingModule,
    ProductionModule,
    CustomersModule,
    DealsModule,
    AiModule,
    AnalyticsModule,
    OrderTypeModule,
    CateringModule,
    EntitlementsModule,
    ApprovalsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: BranchAccessGuard,
    },
    {
      provide: APP_GUARD,
      useClass: TenantGovernanceGuard,
    },
    {
      provide: APP_GUARD,
      useClass: SubscriptionGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    StructuredLoggerService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((req: any, res: any, next: () => void) => {
        const incomingRequestId = req.headers['x-request-id'];
        const requestId = typeof incomingRequestId === 'string' && incomingRequestId.trim()
          ? incomingRequestId.trim()
          : randomUUID();

        req.requestId = requestId;
        res.setHeader('x-request-id', requestId);
        next();
      })
      .forRoutes('*');
  }
}
