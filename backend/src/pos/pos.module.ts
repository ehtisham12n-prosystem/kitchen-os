import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Transaction } from './entities/transaction.entity';
import { OrderCharge } from './entities/order-charge.entity';
import { PosService } from './pos.service';
import { PosController } from './pos.controller';
import { Shift } from './entities/shift.entity';
import { KOT } from './entities/kot.entity';
import { KitchenTableEntity } from '../setup/entities/table.entity';
import { Branch } from '../setup/entities/branch.entity';
import { Floor } from '../setup/entities/floor.entity';
import { BranchCharge } from '../setup/entities/branch-charge.entity';
import { RecipeModule } from '../recipe/recipe.module';
import { InventoryOpModule } from '../inventory-op/inventory-op.module';
import { AccountingModule } from '../accounting/accounting.module';
import { CustomersModule } from '../customers/customers.module';
import { DealsModule } from '../deals/deals.module';
import { AuditModule } from '../platform/audit/audit.module';

import { SaleCounter } from './entities/sale-counter.entity';
import { SaleCounterService } from './sale-counter.service';
import { SaleCounterController } from './sale-counter.controller';
import { PosDevice } from './entities/pos-device.entity';
import { PosSyncEvent } from './entities/pos-sync-event.entity';
import { EntitlementsModule } from '../platform/entitlements/entitlements.module';
import { CatalogModule } from '../catalog/catalog.module';
import { OrderReturn } from './entities/order-return.entity';
import { OrderReturnItem } from './entities/order-return-item.entity';
import { OrderModifier } from './entities/order-modifier.entity';
import { PosVoidLog } from './entities/pos-void-log.entity';
import { Combo } from './entities/combo.entity';
import { ComboItem } from './entities/combo-item.entity';
import { UserManagement } from '../setup/entities/UserManagement.entity';
import { AuthorizedTill } from './entities/authorized-till.entity';
import { BusinessDay } from './entities/business-day.entity';
import { ShiftTemplate } from './entities/shift-template.entity';
import { PosCardMachine } from './entities/pos-card-machine.entity';
import { BranchProductMapping } from '../catalog/entities/branch-product-mapping.entity';
import { TaxConfiguration } from '../setup/entities/tax-configuration.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      Transaction,
      OrderCharge,
      KOT,
      KitchenTableEntity,
      Branch,
      Floor,
      Shift,
      SaleCounter,
      BranchCharge,
      PosDevice,
      PosSyncEvent,
      OrderReturn,
      OrderReturnItem,
      OrderModifier,
      PosVoidLog,
      Combo,
      ComboItem,
      UserManagement,
      AuthorizedTill,
      BusinessDay,
      ShiftTemplate,
      PosCardMachine,
      BranchProductMapping,
      TaxConfiguration,
    ]),
    RecipeModule,
    InventoryOpModule,
    AccountingModule,
    CustomersModule,
    DealsModule,
    AuditModule,
    EntitlementsModule,
    CatalogModule,
  ],
  controllers: [PosController, SaleCounterController],
  providers: [PosService, SaleCounterService],
  exports: [PosService, SaleCounterService],
})
export class PosModule { }
