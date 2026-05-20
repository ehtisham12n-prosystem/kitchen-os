import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { Branch } from '../setup/entities/branch.entity';
import { Order } from '../pos/entities/order.entity';
import { OrderItem } from '../pos/entities/order-item.entity';
import { BranchInventory } from '../inventory/entities/branch-inventory.entity';
import { PurchaseOrder } from '../inventory-op/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../inventory-op/entities/purchase-order-item.entity';
import { ProcurementRequest } from '../inventory-op/entities/procurement-request.entity';
import { ProcurementRequestItem } from '../inventory-op/entities/procurement-request-item.entity';
import { InventoryTransfer } from '../inventory-op/entities/inventory-transfer.entity';
import { InventoryTransferItem } from '../inventory-op/entities/inventory-transfer-item.entity';
import { Shift } from '../pos/entities/shift.entity';
import { StockLedger } from '../inventory-op/entities/stock-ledger.entity';
import { Category } from '../catalog/entities/category.entity';
import { InventoryClass } from '../inventory/entities/inventory-class.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Branch,
      Order,
      OrderItem,
      BranchInventory,
      PurchaseOrder,
      PurchaseOrderItem,
      ProcurementRequest,
      ProcurementRequestItem,
      InventoryTransfer,
      InventoryTransferItem,
      Shift,
      StockLedger,
      Category,
      InventoryClass,
    ]),
  ],
  providers: [AnalyticsService],
  controllers: [AnalyticsController],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
