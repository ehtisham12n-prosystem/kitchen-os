import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockLedger } from './entities/stock-ledger.entity';
import { StockLevel } from './entities/stock-level.entity';
import { InventoryTransfer } from './entities/inventory-transfer.entity';
import { InventoryTransferItem } from './entities/inventory-transfer-item.entity';
import { InventoryTransferEvent } from './entities/inventory-transfer-event.entity';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { InventoryOpService } from './inventory-op.service';
import { InventoryOpController } from './inventory-op.controller';
import { InventoryOpCanonicalController } from './inventory-op-canonical.controller';
import { PurchaseOrdersService } from './purchase-orders/purchase-orders.service';
import { PurchaseOrdersController } from './purchase-orders/purchase-orders.controller';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { Vendor } from '../inventory/entities/vendor.entity';
import { BranchInventory } from '../inventory/entities/branch-inventory.entity';
import { Branch } from '../setup/entities/branch.entity';
import { AccountingModule } from '../accounting/accounting.module';
import { AuditModule } from '../platform/audit/audit.module';
import { TransfersService } from './transfers/transfers.service';
import { TransfersController } from './transfers/transfers.controller';
import { ProductionSupplyController } from './production-supply/production-supply.controller';
import { ProcurementRequest } from './entities/procurement-request.entity';
import { ProcurementRequestItem } from './entities/procurement-request-item.entity';
import { ProcurementRequestsService } from './procurement-requests/procurement-requests.service';
import { ProcurementRequestsController } from './procurement-requests/procurement-requests.controller';
import { GoodsReceiptNote } from './entities/goods-receipt-note.entity';
import { GoodsReceiptNoteItem } from './entities/goods-receipt-note-item.entity';
import { GoodsReceiptReturn } from './entities/goods-receipt-return.entity';
import { GoodsReceiptReturnItem } from './entities/goods-receipt-return-item.entity';
import { InventoryCountSession } from './entities/inventory-count-session.entity';
import { InventoryCountSessionItem } from './entities/inventory-count-session-item.entity';
import { InventoryConsumption } from './entities/inventory-consumption.entity';
import { InventoryConsumptionLine } from './entities/inventory-consumption-line.entity';
import { InventoryWaste } from './entities/inventory-waste.entity';
import { InventoryWasteLine } from './entities/inventory-waste-line.entity';
import { ClientSettings } from '../platform/entities/client-settings.entity';
import { AuditLog } from '../platform/entities/audit-log.entity';
import { ApprovalsModule } from '../approvals/approvals.module';
import { BranchLocation } from '../setup/entities/branch-location.entity';
import { InventoryCountController } from './inventory-count.controller';
import { InventoryCountService } from './inventory-count.service';
import { UomConversionService } from '../common/uom-conversion.service';
import { InventoryConsumptionController } from './inventory-consumption.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            StockLedger,
            StockLevel,
            GoodsReceiptNote,
            GoodsReceiptNoteItem,
            GoodsReceiptReturn,
            GoodsReceiptReturnItem,
            InventoryCountSession,
            InventoryCountSessionItem,
            InventoryConsumption,
            InventoryConsumptionLine,
            InventoryWaste,
            InventoryWasteLine,
            InventoryTransfer,
            InventoryTransferItem,
            InventoryTransferEvent,
            PurchaseOrder,
            PurchaseOrderItem,
            InventoryItem,
            Vendor,
            BranchInventory,
            Branch,
            BranchLocation,
            ClientSettings,
            AuditLog,
            ProcurementRequest,
            ProcurementRequestItem,
        ]),
        AccountingModule,
        ApprovalsModule,
        AuditModule,
    ],
    controllers: [
        InventoryOpCanonicalController,
        InventoryOpController,
        PurchaseOrdersController,
        TransfersController,
        ProductionSupplyController,
        ProcurementRequestsController,
        InventoryCountController,
        InventoryConsumptionController,
    ],
    providers: [
        InventoryOpService,
        InventoryCountService,
        PurchaseOrdersService,
        TransfersService,
        ProcurementRequestsService,
        UomConversionService,
    ],
    exports: [
        InventoryOpService,
        InventoryCountService,
        PurchaseOrdersService,
        TransfersService,
        ProcurementRequestsService,
    ],
})
export class InventoryOpModule { }
