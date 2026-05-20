import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryClass } from './entities/inventory-class.entity';
import { InventoryType } from './entities/inventory-type.entity';
import { InventorySubType } from './entities/inventory-sub-type.entity';
import { InventoryItem } from './entities/inventory-item.entity';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { Vendor } from './entities/vendor.entity';
import { VendorsController } from './vendors/vendors.controller';
import { VendorsService } from './vendors/vendors.service';
import { BranchInventory } from './entities/branch-inventory.entity';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { InventoryOpService } from './inventory-op.service';
import { InventoryOpController } from './inventory-op.controller';
import { InventoryItemRequest } from './entities/inventory-item-request.entity';
import { StockLedger } from '../inventory-op/entities/stock-ledger.entity';
import { StockLevel } from '../inventory-op/entities/stock-level.entity';
import { Branch } from '../setup/entities/branch.entity';
import { AuditModule } from '../platform/audit/audit.module';
import { InventoryOpModule } from '../inventory-op/inventory-op.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryClass,
      InventoryType,
      InventorySubType,
      InventoryItem,
      Vendor,
      BranchInventory,
      PurchaseOrder,
      PurchaseOrderItem,
      StockMovement,
      InventoryItemRequest,
      StockLedger,
      StockLevel,
      Branch,
    ]),
    AuditModule,
    InventoryOpModule,
  ],
  controllers: [InventoryController, VendorsController, InventoryOpController],
  providers: [InventoryService, VendorsService, InventoryOpService],
  exports: [InventoryService, VendorsService, InventoryOpService],
})
export class InventoryModule { }
