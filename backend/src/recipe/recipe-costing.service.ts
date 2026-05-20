import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Recipe } from './entities/recipe.entity';
import { RecipeIngredient } from './entities/recipe-ingredient.entity';
import { Product } from '../catalog/entities/product.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { StockLevel } from '../inventory-op/entities/stock-level.entity';
import { StockLedger } from '../inventory-op/entities/stock-ledger.entity';
import { Branch } from '../setup/entities/branch.entity';
import { BranchProductMapping } from '../catalog/entities/branch-product-mapping.entity';
import { ProductBranchPrice } from '../catalog/entities/product-branch-price.entity';
import { UomConversionService } from '../common/uom-conversion.service';

type CostSourceKind =
  | 'branch_stock_level'
  | 'branch_ledger'
  | 'client_stock_level'
  | 'client_ledger'
  | 'missing';

type SellingPriceSource =
  | 'branch_menu_price'
  | 'branch_base_override'
  | 'master_base_price';

type ResolvedItemCost = {
  unit_cost: number;
  source_kind: CostSourceKind;
  branch_id: number | null;
  branch_name: string | null;
  recorded_at: Date | null;
};

export type RecipeIngredientCostLine = {
  ingredient_id: number;
  item_id: number;
  item_name: string;
  item_sku: string | null;
  quantity: number;
  uom: string;
  base_uom: string;
  base_quantity: number;
  wastage_percentage: number;
  quantity_with_wastage: number;
  unit_cost: number;
  extended_cost: number;
  cost_source_kind: CostSourceKind;
  cost_source_branch_id: number | null;
  cost_source_branch_name: string | null;
  cost_source_recorded_at: Date | null;
  uom_mismatch: boolean;
  is_cost_missing: boolean;
};

export type RecipeCostSummary = {
  recipe_id: number;
  product_id: number;
  recipe_name: string;
  branch_id: number | null;
  branch_name: string | null;
  selling_price: number;
  selling_price_source: SellingPriceSource;
  yield_quantity: number;
  yield_uom: string;
  ingredient_count: number;
  resolved_ingredient_count: number;
  missing_cost_ingredient_count: number;
  uom_mismatch_count: number;
  total_recipe_cost: number;
  cost_per_yield_unit: number;
  margin_amount: number;
  margin_percentage: number | null;
  cost_status: 'complete' | 'partial' | 'missing';
  ingredients: RecipeIngredientCostLine[];
};

export type ProductRecipeCostSummary = {
  product_id: number;
  branch_id: number | null;
  branch_name: string | null;
  recipe_count: number;
  active_recipe_count: number;
  selected_recipe_id: number | null;
  selected_recipe_name: string | null;
  selling_price: number;
  selling_price_source: SellingPriceSource;
  total_recipe_cost: number;
  cost_per_yield_unit: number;
  margin_amount: number;
  margin_percentage: number | null;
  cost_status: 'complete' | 'partial' | 'missing';
  missing_cost_ingredient_count: number;
  uom_mismatch_count: number;
};

@Injectable()
export class RecipeCostingService {
  constructor(
    @InjectRepository(Recipe)
    private readonly recipeRepo: Repository<Recipe>,
    @InjectRepository(RecipeIngredient)
    private readonly ingredientRepo: Repository<RecipeIngredient>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(InventoryItem)
    private readonly itemRepo: Repository<InventoryItem>,
    @InjectRepository(StockLevel)
    private readonly stockLevelRepo: Repository<StockLevel>,
    @InjectRepository(StockLedger)
    private readonly stockLedgerRepo: Repository<StockLedger>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
    @InjectRepository(BranchProductMapping)
    private readonly mappingRepo: Repository<BranchProductMapping>,
    @InjectRepository(ProductBranchPrice)
    private readonly branchPriceRepo: Repository<ProductBranchPrice>,
    private readonly uomConversionService: UomConversionService,
  ) {}

  private normalizeNumber(value: number | string | null | undefined, precision = 4): number {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed)) {
      return 0;
    }

    return Number(parsed.toFixed(precision));
  }

  private normalizePercent(value: number | null): number | null {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return null;
    }

    return Number(value.toFixed(2));
  }

  private pickLatestByDate<T extends { created_at?: Date; updated_at?: Date; id?: number }>(
    current: T | undefined,
    next: T,
    date: Date | null,
    fallbackDate: Date | null,
  ): T {
    if (!current) {
      return next;
    }

    const nextTime = (date ?? fallbackDate)?.getTime() ?? 0;
    const currentTime =
      ((current as T & { last_received_at?: Date }).last_received_at ?? current.updated_at ?? current.created_at)?.getTime()
      ?? 0;

    if (nextTime !== currentTime) {
      return nextTime > currentTime ? next : current;
    }

    return (next.id ?? 0) > (current.id ?? 0) ? next : current;
  }

  private buildResolvedItemCostMap(
    itemIds: number[],
    branchId: number | undefined,
    branchMap: Map<number, Branch>,
    branchLevels: StockLevel[],
    clientLevels: StockLevel[],
    branchLedgers: StockLedger[],
    clientLedgers: StockLedger[],
  ): Map<number, ResolvedItemCost> {
    const branchLevelMap = new Map<number, StockLevel>();
    const clientLevelMap = new Map<number, StockLevel>();
    const branchLedgerMap = new Map<number, StockLedger>();
    const clientLedgerMap = new Map<number, StockLedger>();

    for (const level of branchLevels) {
      if (this.normalizeNumber(level.last_unit_cost) <= 0) {
        continue;
      }
      const current = branchLevelMap.get(level.item_id);
      branchLevelMap.set(
        level.item_id,
        this.pickLatestByDate(current, level, level.last_received_at, level.updated_at),
      );
    }

    for (const level of clientLevels) {
      if (this.normalizeNumber(level.last_unit_cost) <= 0) {
        continue;
      }
      const current = clientLevelMap.get(level.item_id);
      clientLevelMap.set(
        level.item_id,
        this.pickLatestByDate(current, level, level.last_received_at, level.updated_at),
      );
    }

    for (const ledger of branchLedgers) {
      if (this.normalizeNumber(ledger.unit_cost) <= 0 || branchLedgerMap.has(ledger.item_id)) {
        continue;
      }
      branchLedgerMap.set(ledger.item_id, ledger);
    }

    for (const ledger of clientLedgers) {
      if (this.normalizeNumber(ledger.unit_cost) <= 0 || clientLedgerMap.has(ledger.item_id)) {
        continue;
      }
      clientLedgerMap.set(ledger.item_id, ledger);
    }

    const resolved = new Map<number, ResolvedItemCost>();
    for (const itemId of itemIds) {
      const level = branchLevelMap.get(itemId);
      if (level) {
        resolved.set(itemId, {
          unit_cost: this.normalizeNumber(level.last_unit_cost),
          source_kind: 'branch_stock_level',
          branch_id: level.branch_id,
          branch_name: branchMap.get(level.branch_id)?.branch_name ?? null,
          recorded_at: level.last_received_at ?? level.updated_at ?? null,
        });
        continue;
      }

      const ledger = branchLedgerMap.get(itemId);
      if (ledger) {
        resolved.set(itemId, {
          unit_cost: this.normalizeNumber(ledger.unit_cost),
          source_kind: 'branch_ledger',
          branch_id: branchId ?? ledger.branch_id,
          branch_name: branchMap.get(ledger.branch_id)?.branch_name ?? null,
          recorded_at: ledger.created_at ?? null,
        });
        continue;
      }

      const clientLevel = clientLevelMap.get(itemId);
      if (clientLevel) {
        resolved.set(itemId, {
          unit_cost: this.normalizeNumber(clientLevel.last_unit_cost),
          source_kind: 'client_stock_level',
          branch_id: clientLevel.branch_id,
          branch_name: branchMap.get(clientLevel.branch_id)?.branch_name ?? null,
          recorded_at: clientLevel.last_received_at ?? clientLevel.updated_at ?? null,
        });
        continue;
      }

      const clientLedger = clientLedgerMap.get(itemId);
      if (clientLedger) {
        resolved.set(itemId, {
          unit_cost: this.normalizeNumber(clientLedger.unit_cost),
          source_kind: 'client_ledger',
          branch_id: clientLedger.branch_id,
          branch_name: branchMap.get(clientLedger.branch_id)?.branch_name ?? null,
          recorded_at: clientLedger.created_at ?? null,
        });
        continue;
      }

      resolved.set(itemId, {
        unit_cost: 0,
        source_kind: 'missing',
        branch_id: null,
        branch_name: null,
        recorded_at: null,
      });
    }

    return resolved;
  }

  private async loadCostContext(clientId: string, itemIds: number[], branchId?: number) {
    if (itemIds.length === 0) {
      return {
        branchMap: new Map<number, Branch>(),
        itemMap: new Map<number, InventoryItem>(),
        resolvedCostMap: new Map<number, ResolvedItemCost>(),
      };
    }

    const [items, branches, branchLevels, clientLevels, branchLedgers, clientLedgers] = await Promise.all([
      this.itemRepo.find({
        where: {
          client_id: clientId,
          id: In(itemIds),
        },
      }),
      this.branchRepo.find({
        where: { client_id: clientId },
      }),
      branchId
        ? this.stockLevelRepo.find({
            where: {
              client_id: clientId,
              branch_id: branchId,
              item_id: In(itemIds),
            },
          })
        : Promise.resolve([]),
      this.stockLevelRepo.find({
        where: {
          client_id: clientId,
          item_id: In(itemIds),
        },
      }),
      branchId
        ? this.stockLedgerRepo.find({
            where: {
              client_id: clientId,
              branch_id: branchId,
              item_id: In(itemIds),
            },
            order: { created_at: 'DESC', id: 'DESC' },
          })
        : Promise.resolve([]),
      this.stockLedgerRepo.find({
        where: {
          client_id: clientId,
          item_id: In(itemIds),
        },
        order: { created_at: 'DESC', id: 'DESC' },
      }),
    ]);

    const branchMap = new Map(branches.map((branch) => [branch.id, branch]));
    const itemMap = new Map(items.map((item) => [item.id, item]));
    const resolvedCostMap = this.buildResolvedItemCostMap(
      itemIds,
      branchId,
      branchMap,
      branchLevels,
      clientLevels,
      branchLedgers,
      clientLedgers,
    );

    return {
      branchMap,
      itemMap,
      resolvedCostMap,
    };
  }

  private async loadBranchPricingContext(clientId: string, productIds: number[], branchId?: number) {
    if (!branchId || productIds.length === 0) {
      return {
        branchName: null,
        priceMap: new Map<number, { selling_price: number; source: SellingPriceSource }>(),
      };
    }

    const [branch, mappings, prices] = await Promise.all([
      this.branchRepo.findOne({ where: { id: branchId, client_id: clientId } }),
      this.mappingRepo.find({
        where: {
          branch_id: branchId,
          product_id: In(productIds),
        },
      }),
      this.branchPriceRepo.find({
        where: {
          branch_id: branchId,
          product_id: In(productIds),
        },
      }),
    ]);

    const mappingMap = new Map(mappings.map((mapping) => [mapping.product_id, mapping]));
    const basePriceMap = new Map<string, ProductBranchPrice>();
    for (const price of prices) {
      if (price.customization_id) {
        continue;
      }
      basePriceMap.set(`${price.product_id}:${price.price_profile_id}`, price);
    }

    const products = await this.productRepo.find({
      where: {
        client_id: clientId,
        id: In(productIds),
      },
    });

    const priceMap = new Map<number, { selling_price: number; source: SellingPriceSource }>();
    for (const product of products) {
      const mapping = mappingMap.get(product.id);
      const effectivePriceProfileId = mapping?.price_profile_id ?? product.price_profile_id ?? null;
      if (effectivePriceProfileId) {
        const branchPrice = basePriceMap.get(`${product.id}:${effectivePriceProfileId}`);
        if (branchPrice) {
          priceMap.set(product.id, {
            selling_price: this.normalizeNumber(branchPrice.price),
            source: 'branch_menu_price',
          });
          continue;
        }
      }

      if (mapping?.price_override !== null && mapping?.price_override !== undefined) {
        priceMap.set(product.id, {
          selling_price: this.normalizeNumber(mapping.price_override),
          source: 'branch_base_override',
        });
        continue;
      }

      priceMap.set(product.id, {
        selling_price: this.normalizeNumber(product.product_base_price),
        source: 'master_base_price',
      });
    }

    return {
      branchName: branch?.branch_name ?? null,
      priceMap,
    };
  }

  private buildRecipeCostSummary(
    recipe: Recipe,
    ingredients: RecipeIngredient[],
    itemMap: Map<number, InventoryItem>,
    resolvedCostMap: Map<number, ResolvedItemCost>,
    branchId: number | undefined,
    branchName: string | null,
    sellingPrice: number,
    sellingPriceSource: SellingPriceSource,
  ): RecipeCostSummary {
    const lines = ingredients.map((ingredient) => {
      const item = ingredient.item ?? itemMap.get(ingredient.item_id);
      const resolvedCost = resolvedCostMap.get(ingredient.item_id) ?? {
        unit_cost: 0,
        source_kind: 'missing' as const,
        branch_id: null,
        branch_name: null,
        recorded_at: null,
      };
      const enteredQuantity = this.normalizeNumber(ingredient.quantity);
      const wastagePercentage = this.normalizeNumber(ingredient.wastage_percentage, 2);
      const baseUom = item?.uom_base ?? ingredient.uom;
      let quantity = enteredQuantity;
      let uomMismatch = false;
      try {
        quantity = this.normalizeNumber(
          this.uomConversionService.convert(enteredQuantity, ingredient.uom, baseUom),
        );
        uomMismatch = false;
      } catch {
        uomMismatch = Boolean(ingredient.uom && baseUom)
          && ingredient.uom.trim().toLowerCase() !== baseUom.trim().toLowerCase();
      }
      const quantityWithWastage = this.normalizeNumber(
        quantity * (1 + wastagePercentage / 100),
      );
      const unitCost = this.normalizeNumber(resolvedCost.unit_cost);
      const extendedCost = this.normalizeNumber(quantityWithWastage * unitCost);
      return {
        ingredient_id: ingredient.id,
        item_id: ingredient.item_id,
        item_name: item?.item_name ?? `Item #${ingredient.item_id}`,
        item_sku: item?.item_sku ?? null,
        quantity: enteredQuantity,
        uom: ingredient.uom,
        base_uom: baseUom,
        wastage_percentage: wastagePercentage,
        base_quantity: quantity,
        quantity_with_wastage: quantityWithWastage,
        unit_cost: unitCost,
        extended_cost: extendedCost,
        cost_source_kind: resolvedCost.source_kind,
        cost_source_branch_id: resolvedCost.branch_id,
        cost_source_branch_name: resolvedCost.branch_name,
        cost_source_recorded_at: resolvedCost.recorded_at,
        uom_mismatch: uomMismatch,
        is_cost_missing: resolvedCost.source_kind === 'missing' || unitCost <= 0,
      };
    });

    const ingredientCount = lines.length;
    const resolvedIngredientCount = lines.filter((line) => !line.is_cost_missing).length;
    const missingCostIngredientCount = lines.filter((line) => line.is_cost_missing).length;
    const uomMismatchCount = lines.filter((line) => line.uom_mismatch).length;
    const totalRecipeCost = this.normalizeNumber(
      lines.reduce((sum, line) => sum + line.extended_cost, 0),
    );
    const yieldQuantity = this.normalizeNumber(recipe.yield_quantity);
    const costPerYieldUnit = yieldQuantity > 0
      ? this.normalizeNumber(totalRecipeCost / yieldQuantity)
      : 0;
    const marginAmount = this.normalizeNumber(sellingPrice - costPerYieldUnit);
    const marginPercentage = sellingPrice > 0
      ? this.normalizePercent((marginAmount / sellingPrice) * 100)
      : null;

    let costStatus: RecipeCostSummary['cost_status'] = 'missing';
    if (ingredientCount > 0 && resolvedIngredientCount === ingredientCount) {
      costStatus = 'complete';
    } else if (resolvedIngredientCount > 0) {
      costStatus = 'partial';
    }

    return {
      recipe_id: recipe.id,
      product_id: recipe.product_id,
      recipe_name: recipe.recipe_name,
      branch_id: branchId ?? null,
      branch_name: branchName,
      selling_price: this.normalizeNumber(sellingPrice),
      selling_price_source: sellingPriceSource,
      yield_quantity: yieldQuantity,
      yield_uom: recipe.yield_uom,
      ingredient_count: ingredientCount,
      resolved_ingredient_count: resolvedIngredientCount,
      missing_cost_ingredient_count: missingCostIngredientCount,
      uom_mismatch_count: uomMismatchCount,
      total_recipe_cost: totalRecipeCost,
      cost_per_yield_unit: costPerYieldUnit,
      margin_amount: marginAmount,
      margin_percentage: marginPercentage,
      cost_status: costStatus,
      ingredients: lines,
    };
  }

  async getRecipeCostSummaries(
    clientId: string,
    recipes: Recipe[],
    branchId?: number,
  ): Promise<Map<number, RecipeCostSummary>> {
    if (recipes.length === 0) {
      return new Map();
    }

    const recipeIds = recipes.map((recipe) => recipe.id);
    const productIds = [...new Set(recipes.map((recipe) => recipe.product_id))];
    const ingredients = await this.ingredientRepo.find({
      where: { recipe_id: In(recipeIds) },
      relations: ['item'],
      order: { id: 'ASC' },
    });
    const ingredientsByRecipe = new Map<number, RecipeIngredient[]>();
    for (const ingredient of ingredients) {
      const bucket = ingredientsByRecipe.get(ingredient.recipe_id) ?? [];
      bucket.push(ingredient);
      ingredientsByRecipe.set(ingredient.recipe_id, bucket);
    }

    const itemIds = [...new Set(ingredients.map((ingredient) => ingredient.item_id))];
    const [costContext, pricingContext] = await Promise.all([
      this.loadCostContext(clientId, itemIds, branchId),
      this.loadBranchPricingContext(clientId, productIds, branchId),
    ]);
    const summaries = new Map<number, RecipeCostSummary>();
    for (const recipe of recipes) {
      const productPrice = pricingContext.priceMap.get(recipe.product_id) ?? {
        selling_price: this.normalizeNumber(recipe.product?.product_base_price),
        source: 'master_base_price' as SellingPriceSource,
      };
      summaries.set(
        recipe.id,
        this.buildRecipeCostSummary(
          recipe,
          ingredientsByRecipe.get(recipe.id) ?? [],
          costContext.itemMap,
          costContext.resolvedCostMap,
          branchId,
          pricingContext.branchName,
          productPrice.selling_price,
          productPrice.source,
        ),
      );
    }

    return summaries;
  }

  async getRecipeCostSummary(
    clientId: string,
    recipeId: number,
    branchId?: number,
  ): Promise<RecipeCostSummary | null> {
    const recipe = await this.recipeRepo.findOne({
      where: { id: recipeId, client_id: clientId },
      relations: ['product'],
    });
    if (!recipe) {
      return null;
    }

    const summaries = await this.getRecipeCostSummaries(clientId, [recipe], branchId);
    return summaries.get(recipeId) ?? null;
  }

  async getProductRecipeCostSummaries(
    clientId: string,
    products: Product[],
    branchId?: number,
  ): Promise<Map<number, ProductRecipeCostSummary>> {
    if (products.length === 0) {
      return new Map();
    }

    const productIds = products.map((product) => product.id);
    const recipes = await this.recipeRepo.find({
      where: {
        client_id: clientId,
        product_id: In(productIds),
      },
      relations: ['product'],
      order: {
        is_active: 'DESC',
        updated_at: 'DESC',
        id: 'DESC',
      },
    });
    const recipeSummaries = await this.getRecipeCostSummaries(clientId, recipes, branchId);
    const branchPricingContext = await this.loadBranchPricingContext(clientId, productIds, branchId);

    const recipesByProduct = new Map<number, Recipe[]>();
    for (const recipe of recipes) {
      const bucket = recipesByProduct.get(recipe.product_id) ?? [];
      bucket.push(recipe);
      recipesByProduct.set(recipe.product_id, bucket);
    }

    const summaries = new Map<number, ProductRecipeCostSummary>();
    for (const product of products) {
      const productRecipes = recipesByProduct.get(product.id) ?? [];
      const selectedRecipe = productRecipes[0] ?? null;
      const selectedSummary = selectedRecipe ? recipeSummaries.get(selectedRecipe.id) ?? null : null;
      const pricing = branchPricingContext.priceMap.get(product.id) ?? {
        selling_price: this.normalizeNumber(product.product_base_price),
        source: 'master_base_price' as SellingPriceSource,
      };

      summaries.set(product.id, {
        product_id: product.id,
        branch_id: branchId ?? null,
        branch_name: branchPricingContext.branchName,
        recipe_count: productRecipes.length,
        active_recipe_count: productRecipes.filter((recipe) => recipe.is_active).length,
        selected_recipe_id: selectedRecipe?.id ?? null,
        selected_recipe_name: selectedRecipe?.recipe_name ?? null,
        selling_price: selectedSummary?.selling_price ?? pricing.selling_price,
        selling_price_source: selectedSummary?.selling_price_source ?? pricing.source,
        total_recipe_cost: selectedSummary?.total_recipe_cost ?? 0,
        cost_per_yield_unit: selectedSummary?.cost_per_yield_unit ?? 0,
        margin_amount: selectedSummary
          ? selectedSummary.margin_amount
          : this.normalizeNumber(pricing.selling_price),
        margin_percentage: selectedSummary?.margin_percentage ?? null,
        cost_status: selectedSummary?.cost_status ?? 'missing',
        missing_cost_ingredient_count: selectedSummary?.missing_cost_ingredient_count ?? 0,
        uom_mismatch_count: selectedSummary?.uom_mismatch_count ?? 0,
      });
    }

    return summaries;
  }

  async getProductRecipeCostSummary(
    clientId: string,
    productId: number,
    branchId?: number,
  ): Promise<ProductRecipeCostSummary | null> {
    const product = await this.productRepo.findOne({
      where: { id: productId, client_id: clientId },
    });
    if (!product) {
      return null;
    }

    const summaries = await this.getProductRecipeCostSummaries(clientId, [product], branchId);
    return summaries.get(productId) ?? null;
  }
}
