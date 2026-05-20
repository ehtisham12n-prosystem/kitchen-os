import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../catalog/entities/product.entity';
import { CatalogModule } from '../catalog/catalog.module';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { BranchInventory } from '../inventory/entities/branch-inventory.entity';
import { InventoryOpModule } from '../inventory-op/inventory-op.module';
import { StockLedger } from '../inventory-op/entities/stock-ledger.entity';
import { StockLevel } from '../inventory-op/entities/stock-level.entity';
import { AuditModule } from '../platform/audit/audit.module';
import { Recipe } from '../recipe/entities/recipe.entity';
import { RecipeIngredient } from '../recipe/entities/recipe-ingredient.entity';
import { ProductionOrderBatch } from './entities/production-order-batch.entity';
import { ProductionOrder } from './entities/production-order.entity';
import { ProductionOrderMaterial } from './entities/production-order-material.entity';
import { ProductionService } from './production.service';
import { ProductionController } from './production.controller';
import { Branch } from '../setup/entities/branch.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductionOrder,
      ProductionOrderBatch,
      ProductionOrderMaterial,
      Branch,
      Product,
      InventoryItem,
      BranchInventory,
      Recipe,
      RecipeIngredient,
      StockLedger,
      StockLevel,
    ]),
    InventoryOpModule,
    AuditModule,
    CatalogModule,
  ],
  controllers: [ProductionController],
  providers: [ProductionService],
  exports: [ProductionService],
})
export class ProductionModule {}
