import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { Product } from './entities/product.entity';
import { ProductCustomization } from './entities/product-customization.entity';
import { BranchProductMapping } from './entities/branch-product-mapping.entity';
import { PriceProfile } from './entities/price-profile.entity';
import { CuisineType } from './entities/cuisine-type.entity';
import { Station } from './entities/station.entity';
import { Uom } from './entities/uom.entity';
import { ProductBranchPrice } from './entities/product-branch-price.entity';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';
import { Client } from '../platform/entities/client.entity';
import { Branch } from '../setup/entities/branch.entity';
import { TaxConfiguration } from '../setup/entities/tax-configuration.entity';
import { RecipeModule } from '../recipe/recipe.module';
import { UomConversionService } from '../common/uom-conversion.service';

@Module({
  imports: [
    RecipeModule,
    TypeOrmModule.forFeature([
      Category,
      Product,
      ProductCustomization,
      BranchProductMapping,
      ProductBranchPrice,
      PriceProfile,
      CuisineType,
      Station,
      Uom,
      Client,
      Branch,
      TaxConfiguration,
    ]),
  ],
  controllers: [CatalogController],
  providers: [CatalogService, UomConversionService],
  exports: [CatalogService], // Export if POS sync module needs direct access
})
export class CatalogModule { }
