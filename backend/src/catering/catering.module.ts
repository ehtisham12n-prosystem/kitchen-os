import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountingModule } from '../accounting/accounting.module';
import { Product } from '../catalog/entities/product.entity';
import { Customer } from '../customers/entities/customer.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { InventoryOpModule } from '../inventory-op/inventory-op.module';
import { StockLedger } from '../inventory-op/entities/stock-ledger.entity';
import { StockLevel } from '../inventory-op/entities/stock-level.entity';
import { AuditModule } from '../platform/audit/audit.module';
import { ProductionModule } from '../production/production.module';
import { RecipeModule } from '../recipe/recipe.module';
import { Recipe } from '../recipe/entities/recipe.entity';
import { Branch } from '../setup/entities/branch.entity';
import { CateringController } from './catering.controller';
import { CateringService } from './catering.service';
import { ChartOfAccount } from '../accounting/entities/chart-of-accounts.entity';
import { CateringEvent } from './entities/catering-event.entity';
import { CateringEventBilling } from './entities/catering-event-billing.entity';
import { CateringEventItem } from './entities/catering-event-item.entity';
import { CateringEventProcurementLink } from './entities/catering-event-procurement-link.entity';
import { CateringEventProductionLink } from './entities/catering-event-production-link.entity';
import { CateringEventSettlement } from './entities/catering-event-settlement.entity';
import { CateringInquiry } from './entities/catering-inquiry.entity';
import { CateringQuotation } from './entities/catering-quotation.entity';
import { CateringQuotationItem } from './entities/catering-quotation-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CateringInquiry,
      CateringQuotation,
      CateringQuotationItem,
      CateringEvent,
      CateringEventBilling,
      CateringEventItem,
      CateringEventProcurementLink,
      CateringEventProductionLink,
      CateringEventSettlement,
      Customer,
      Branch,
      Product,
      InventoryItem,
      Recipe,
      StockLevel,
      StockLedger,
      ChartOfAccount,
    ]),
    InventoryOpModule,
    ProductionModule,
    RecipeModule,
    AccountingModule,
    AuditModule,
  ],
  controllers: [CateringController],
  providers: [CateringService],
  exports: [CateringService],
})
export class CateringModule {}
