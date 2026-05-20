import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Recipe } from './entities/recipe.entity';
import { RecipeIngredient } from './entities/recipe-ingredient.entity';
import { RecipeService } from './recipe.service';
import { RecipeCostingService } from './recipe-costing.service';
import { UomConversionService } from '../common/uom-conversion.service';
import { RecipeController } from './recipe.controller';
import { Product } from '../catalog/entities/product.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { StockLevel } from '../inventory-op/entities/stock-level.entity';
import { StockLedger } from '../inventory-op/entities/stock-ledger.entity';
import { Branch } from '../setup/entities/branch.entity';
import { BranchProductMapping } from '../catalog/entities/branch-product-mapping.entity';
import { ProductBranchPrice } from '../catalog/entities/product-branch-price.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Recipe,
            RecipeIngredient,
            Product,
            InventoryItem,
            StockLevel,
            StockLedger,
            Branch,
            BranchProductMapping,
            ProductBranchPrice,
        ]),
    ],
    controllers: [RecipeController],
    providers: [RecipeService, RecipeCostingService, UomConversionService],
    exports: [RecipeService, RecipeCostingService],
})
export class RecipeModule { }
