import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { APP_PERMISSIONS } from '../auth/constants/permissions';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import {
  requireBranchId,
  requireClientId,
} from '../auth/request-context.util';
import { RequestUser } from '../auth/decorators/user.decorator';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import { CatalogService } from './catalog.service';
import {
  BulkSetBranchMappingDto,
  CreateCuisineTypeDto,
  CreateProductDto,
  CreateUomDto,
  SetBranchMappingDto,
  UpdateBranchPriceDto,
  UpdateCuisineTypeDto,
  UpdateProductDto,
  UpdateUomDto,
} from './dto/catalog-write.dto';
import {
  CreateCategoryDto,
  CreatePriceProfileDto,
  ReassignTaxonomyDependenciesDto,
  CreateStationDto,
  UpdateCategoryDto,
  UpdatePriceProfileDto,
  UpdateStationDto,
} from './dto/taxonomy.dto';

@Controller('v1/catalog')
@UseGuards(JwtAuthGuard)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  private serializeUom<T extends { abbreviation?: string; base_unit?: { abbreviation?: string } | null }>(uom: T) {
    return {
      ...uom,
      short_code: uom.abbreviation,
      base_unit: uom.base_unit
        ? {
            ...uom.base_unit,
            short_code: uom.base_unit.abbreviation,
          }
        : uom.base_unit,
    };
  }

  @Post('categories')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.WRITE)
  async createCategory(@RequestUser() user: JwtPayload, @Body() body: CreateCategoryDto) {
    return this.catalogService.createCategory(requireClientId(user), body);
  }

  @Patch('categories/:id')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.WRITE)
  async updateCategory(
    @RequestUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: UpdateCategoryDto,
  ) {
    return this.catalogService.updateCategory(requireClientId(user), +id, body);
  }

  @Delete('categories/:id')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.WRITE)
  async removeCategory(@RequestUser() user: JwtPayload, @Param('id') id: string) {
    await this.catalogService.removeCategory(requireClientId(user), +id);
    return { message: 'Category deleted successfully' };
  }

  @Post('products')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.WRITE)
  async createProduct(@RequestUser() user: JwtPayload, @Body() body: CreateProductDto) {
    return this.catalogService.createProduct(requireClientId(user), body);
  }

  @Get('products/:id')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.READ)
  async findOneProduct(@RequestUser() user: JwtPayload, @Param('id') id: string) {
    return this.catalogService.findOneProduct(requireClientId(user), +id);
  }

  @Get('categories')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.READ)
  async findAllCategories(@RequestUser() user: JwtPayload) {
    return this.catalogService.findAllCategories(requireClientId(user));
  }

  @Get('taxonomies/:kind/:id/dependencies')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.READ)
  async getTaxonomyDependencies(
    @RequestUser() user: JwtPayload,
    @Param('kind') kind: string,
    @Param('id') id: string,
  ) {
    return this.catalogService.getTaxonomyDependencies(requireClientId(user), kind, +id);
  }

  @Post('taxonomies/:kind/:id/reassign')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.WRITE)
  async reassignTaxonomyDependencies(
    @RequestUser() user: JwtPayload,
    @Param('kind') kind: string,
    @Param('id') id: string,
    @Body() body: ReassignTaxonomyDependenciesDto,
  ) {
    return this.catalogService.reassignTaxonomyDependencies(
      requireClientId(user),
      kind,
      +id,
      body.target_id,
      body.product_ids,
    );
  }

  @Get('products')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.READ)
  async findAllProducts(
    @RequestUser() user: JwtPayload,
    @Query('category_id') categoryId?: number,
  ) {
    return this.catalogService.findAllProducts(requireClientId(user), categoryId);
  }

  @Patch('products/:id')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.WRITE)
  async updateProduct(
    @RequestUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: UpdateProductDto,
  ) {
    return this.catalogService.updateProduct(requireClientId(user), +id, body);
  }

  @Delete('products/:id')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.WRITE)
  async removeProduct(@RequestUser() user: JwtPayload, @Param('id') id: string) {
    await this.catalogService.removeProduct(requireClientId(user), +id);
    return { message: 'Product deleted successfully' };
  }

  @Get('branch-products')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.READ)
  async getBranchProducts(
    @RequestUser() user: JwtPayload,
    @Query('branch_id') branchId?: string,
  ) {
    const clientId = requireClientId(user);
    const resolvedBranchId = requireBranchId(user, branchId);
    return this.catalogService.getProductsWithBranchStatus(clientId, resolvedBranchId);
  }

  @Get('branch-pricing')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.READ)
  async getBranchPricing(
    @RequestUser() user: JwtPayload,
    @Query('branch_id') branchId?: string,
    @Query('price_profile_id') priceProfileId?: string,
  ) {
    const clientId = requireClientId(user);
    const resolvedBranchId = requireBranchId(user, branchId);
    return this.catalogService.getBranchPricing(
      clientId,
      resolvedBranchId,
      priceProfileId ? Number(priceProfileId) : undefined,
    );
  }

  @Post('branch-pricing')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.WRITE)
  async updateBranchPrice(@RequestUser() user: JwtPayload, @Body() body: UpdateBranchPriceDto) {
    const clientId = requireClientId(user);
    const branchId = requireBranchId(user, body.branch_id);
    return this.catalogService.updateBranchPrice(clientId, branchId, body);
  }

  @Post('price-profiles')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.WRITE)
  async createPriceProfile(@RequestUser() user: JwtPayload, @Body() body: CreatePriceProfileDto) {
    return this.catalogService.createPriceProfile(requireClientId(user), body);
  }

  @Patch('price-profiles/:id')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.WRITE)
  async updatePriceProfile(
    @RequestUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: UpdatePriceProfileDto,
  ) {
    return this.catalogService.updatePriceProfile(requireClientId(user), +id, body);
  }

  @Delete('price-profiles/:id')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.WRITE)
  async removePriceProfile(@RequestUser() user: JwtPayload, @Param('id') id: string) {
    await this.catalogService.removePriceProfile(requireClientId(user), +id);
    return { message: 'Price Profile deleted successfully' };
  }

  @Get('price-profiles')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.READ)
  async findAllPriceProfiles(@RequestUser() user: JwtPayload) {
    return this.catalogService.findAllPriceProfiles(requireClientId(user));
  }

  @Post('cuisine-types')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.WRITE)
  async createCuisineType(@RequestUser() user: JwtPayload, @Body() body: CreateCuisineTypeDto) {
    return this.catalogService.createCuisineType(requireClientId(user), body);
  }

  @Patch('cuisine-types/:id')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.WRITE)
  async updateCuisineType(
    @RequestUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: UpdateCuisineTypeDto,
  ) {
    return this.catalogService.updateCuisineType(requireClientId(user), +id, body);
  }

  @Delete('cuisine-types/:id')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.WRITE)
  async removeCuisineType(@RequestUser() user: JwtPayload, @Param('id') id: string) {
    await this.catalogService.removeCuisineType(requireClientId(user), +id);
    return { message: 'Cuisine Type deleted successfully' };
  }

  @Get('cuisine-types')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.READ)
  async findAllCuisineTypes(@RequestUser() user: JwtPayload) {
    return this.catalogService.findAllCuisineTypes(requireClientId(user));
  }

  @Post('stations')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.WRITE)
  async createStation(@RequestUser() user: JwtPayload, @Body() body: CreateStationDto) {
    return this.catalogService.createStation(requireClientId(user), body);
  }

  @Patch('stations/:id')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.WRITE)
  async updateStation(
    @RequestUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: UpdateStationDto,
  ) {
    return this.catalogService.updateStation(requireClientId(user), +id, body);
  }

  @Delete('stations/:id')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.WRITE)
  async removeStation(@RequestUser() user: JwtPayload, @Param('id') id: string) {
    await this.catalogService.removeStation(requireClientId(user), +id);
    return { message: 'Station deleted successfully' };
  }

  @Get('stations')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.READ)
  async findAllStations(@RequestUser() user: JwtPayload) {
    return this.catalogService.findAllStations(requireClientId(user));
  }

  @Post('uoms')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.WRITE)
  async createUom(@RequestUser() user: JwtPayload, @Body() body: CreateUomDto) {
    return this.serializeUom(await this.catalogService.createUom(requireClientId(user), body));
  }

  @Patch('uoms/:id')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.WRITE)
  async updateUom(
    @RequestUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: UpdateUomDto,
  ) {
    return this.serializeUom(await this.catalogService.updateUom(requireClientId(user), +id, body));
  }

  @Delete('uoms/:id')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.WRITE)
  async removeUom(@RequestUser() user: JwtPayload, @Param('id') id: string) {
    await this.catalogService.removeUom(requireClientId(user), +id);
    return { message: 'UOM deleted successfully' };
  }

  @Get('uoms')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.READ)
  async findAllUoms(@RequestUser() user: JwtPayload) {
    const items = await this.catalogService.findAllUoms(requireClientId(user));
    return items.map((item) => this.serializeUom(item));
  }

  @Post('uoms/seed-defaults')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.WRITE)
  async seedDefaultUoms(@RequestUser() user: JwtPayload) {
    const items = await this.catalogService.seedDefaultUoms(requireClientId(user));
    return items.map((item) => this.serializeUom(item));
  }

  @Post('mappings')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.WRITE)
  async setMapping(@RequestUser() user: JwtPayload, @Body() body: SetBranchMappingDto) {
    const clientId = requireClientId(user);
    const branchId = requireBranchId(user, body.branch_id);
    return this.catalogService.setBranchMapping(
      clientId,
      branchId,
      body.product_id,
      body.is_enabled,
      body.price_override,
      body.price_profile_id,
      body.channel_availability,
      body.allow_open_order_return,
      body.temporarily_disabled_until,
      body.temporary_disable_reason,
    );
  }

  @Post('mappings/bulk')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.WRITE)
  async bulkSetMapping(@RequestUser() user: JwtPayload, @Body() body: BulkSetBranchMappingDto) {
    const clientId = requireClientId(user);
    const branchId = requireBranchId(user, body.branch_id);
    return this.catalogService.bulkSetBranchMappings(clientId, branchId, body.items);
  }

  @Get('menu/branch/:branchId')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.READ)
  async getBranchMenu(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Query('price_profile_id') priceProfileId?: string,
    @Query('channel') channel?: string,
  ) {
    return this.catalogService.getBranchMenu(
      requireClientId(user),
      requireBranchId(user, branchId),
      priceProfileId ? Number(priceProfileId) : undefined,
      channel,
    );
  }
}
