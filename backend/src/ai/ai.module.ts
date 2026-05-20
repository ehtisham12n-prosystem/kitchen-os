import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiAnalyticsService } from './ai-analytics.service';
import { AiAnalyticsController } from './ai-analytics.controller';
import { Order } from '../pos/entities/order.entity';
import { ProductionOrder } from '../production/entities/production-order.entity';
import { BranchInventory } from '../inventory/entities/branch-inventory.entity';
import { StockLevel } from '../inventory-op/entities/stock-level.entity';
import { StockLedger } from '../inventory-op/entities/stock-ledger.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { Product } from '../catalog/entities/product.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Order, ProductionOrder, BranchInventory, StockLevel, StockLedger, InventoryItem, Product]),
    ],
    providers: [AiAnalyticsService],
    controllers: [AiAnalyticsController],
    exports: [AiAnalyticsService],
})
export class AiModule { }
