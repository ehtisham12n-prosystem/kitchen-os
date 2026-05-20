import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Recipe } from './entities/recipe.entity';
import { RecipeIngredient } from './entities/recipe-ingredient.entity';
import { Product } from '../catalog/entities/product.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import {
    CreateRecipeDto,
    RecipeIngredientWriteDto,
    UpdateRecipeDto,
} from './dto/recipe.dto';
import { RecipeCostingService } from './recipe-costing.service';
import { UomConversionService } from '../common/uom-conversion.service';

@Injectable()
export class RecipeService {
    constructor(
        @InjectRepository(Recipe)
        private readonly recipeRepo: Repository<Recipe>,
        @InjectRepository(RecipeIngredient)
        private readonly ingredientRepo: Repository<RecipeIngredient>,
        @InjectRepository(Product)
        private readonly productRepo: Repository<Product>,
        @InjectRepository(InventoryItem)
        private readonly itemRepo: Repository<InventoryItem>,
        private readonly recipeCostingService: RecipeCostingService,
        private readonly uomConversionService: UomConversionService,
    ) { }

    private async assertProductBelongsToClient(clientId: string, productId: number): Promise<Product> {
        const product = await this.productRepo.findOne({
            where: { id: productId, client_id: clientId },
        });
        if (!product) throw new NotFoundException('Product not found.');
        return product;
    }

    private async assertItemBelongsToClient(clientId: string, itemId: number): Promise<InventoryItem> {
        const item = await this.itemRepo.findOne({
            where: { id: itemId, client_id: clientId, item_is_active: true },
        });
        if (!item) throw new NotFoundException('Inventory Item not found.');
        return item;
    }

    private async getRecipeEntity(clientId: string, recipeId: number): Promise<Recipe> {
        const recipe = await this.recipeRepo.findOne({
            where: { id: recipeId, client_id: clientId },
        });
        if (!recipe) throw new NotFoundException('Recipe not found.');
        return recipe;
    }

    private async replaceIngredients(
        clientId: string,
        recipeId: number,
        ingredients?: RecipeIngredientWriteDto[],
    ): Promise<void> {
        if (!ingredients) {
            return;
        }

        await this.ingredientRepo.delete({ recipe_id: recipeId });

        for (const ingredient of ingredients) {
            const item = await this.assertItemBelongsToClient(clientId, ingredient.item_id);
            this.uomConversionService.toBase(ingredient.quantity, ingredient.uom || item.uom_base, item.uom_base);
            const entity = this.ingredientRepo.create({
                recipe_id: recipeId,
                item_id: ingredient.item_id,
                quantity: ingredient.quantity,
                uom: ingredient.uom || item.uom_base,
                wastage_percentage: ingredient.wastage_percentage ?? 0,
            });
            await this.ingredientRepo.save(entity);
        }
    }

    async createRecipe(clientId: string, dto: CreateRecipeDto): Promise<any> {
        await this.assertProductBelongsToClient(clientId, dto.product_id);

        const recipe = this.recipeRepo.create({
            client_id: clientId,
            product_id: dto.product_id,
            recipe_name: dto.recipe_name,
            yield_quantity: dto.yield_quantity,
            yield_uom: dto.yield_uom,
            description: dto.description ?? null,
            preparation_method: dto.preparation_method ?? null,
            serves_people: dto.serves_people ?? null,
            image_url: dto.image_url ?? null,
            prepared_by: dto.prepared_by ?? null,
            is_active: dto.is_active ?? true,
        });

        const saved = await this.recipeRepo.save(recipe);
        await this.replaceIngredients(clientId, saved.id, dto.ingredients);
        return this.getRecipeDetails(clientId, saved.id);
    }

    async updateRecipe(clientId: string, recipeId: number, dto: UpdateRecipeDto): Promise<any> {
        const recipe = await this.getRecipeEntity(clientId, recipeId);
        if (recipe.is_locked) {
            throw new BadRequestException('Recipe is locked. Unlock it before changing ingredients or costing inputs.');
        }

        if (dto.product_id !== undefined) {
            await this.assertProductBelongsToClient(clientId, dto.product_id);
        }

        Object.assign(recipe, {
            ...dto,
            description: dto.description ?? recipe.description,
            preparation_method: dto.preparation_method ?? recipe.preparation_method,
            serves_people: dto.serves_people ?? recipe.serves_people,
            image_url: dto.image_url ?? recipe.image_url,
            prepared_by: dto.prepared_by ?? recipe.prepared_by,
        });

        await this.recipeRepo.save(recipe);
        await this.replaceIngredients(clientId, recipeId, dto.ingredients);
        return this.getRecipeDetails(clientId, recipeId);
    }

    async deleteRecipe(clientId: string, recipeId: number): Promise<void> {
        const recipe = await this.getRecipeEntity(clientId, recipeId);
        if (recipe.is_locked) {
            throw new BadRequestException('Recipe is locked. Unlock it before deleting.');
        }

        await this.ingredientRepo.delete({ recipe_id: recipeId });
        await this.recipeRepo.delete({ id: recipeId, client_id: clientId });
    }

    async addIngredient(clientId: string, recipeId: number, dto: RecipeIngredientWriteDto): Promise<RecipeIngredient> {
        const recipe = await this.getRecipeEntity(clientId, recipeId);
        if (recipe.is_locked) {
            throw new BadRequestException('Recipe is locked. Unlock it before changing ingredients.');
        }
        const item = await this.assertItemBelongsToClient(clientId, dto.item_id);
        this.uomConversionService.toBase(dto.quantity, dto.uom || item.uom_base, item.uom_base);

        const ingredient = this.ingredientRepo.create({
            recipe_id: recipeId,
            item_id: dto.item_id,
            quantity: dto.quantity,
            uom: dto.uom || item.uom_base,
            wastage_percentage: dto.wastage_percentage ?? 0,
        });
        return this.ingredientRepo.save(ingredient);
    }

    async updateIngredient(
        clientId: string,
        recipeId: number,
        ingredientId: number,
        dto: RecipeIngredientWriteDto,
    ): Promise<RecipeIngredient> {
        const recipe = await this.getRecipeEntity(clientId, recipeId);
        if (recipe.is_locked) {
            throw new BadRequestException('Recipe is locked. Unlock it before changing ingredients.');
        }

        const ingredient = await this.ingredientRepo.findOne({
            where: { id: ingredientId, recipe_id: recipeId },
        });
        if (!ingredient) throw new NotFoundException('Ingredient not found in this recipe.');

        const item = await this.assertItemBelongsToClient(clientId, dto.item_id);
        this.uomConversionService.toBase(dto.quantity, dto.uom || item.uom_base, item.uom_base);

        Object.assign(ingredient, {
            item_id: dto.item_id,
            quantity: dto.quantity,
            uom: dto.uom || item.uom_base,
            wastage_percentage: dto.wastage_percentage ?? 0,
        });
        return this.ingredientRepo.save(ingredient);
    }

    async removeIngredient(clientId: string, recipeId: number, ingredientId: number): Promise<void> {
        const recipe = await this.getRecipeEntity(clientId, recipeId);
        if (recipe.is_locked) {
            throw new BadRequestException('Recipe is locked. Unlock it before changing ingredients.');
        }
        await this.ingredientRepo.delete({ id: ingredientId, recipe_id: recipeId });
    }

    async findAll(clientId: string, branchId?: number): Promise<any[]> {
        const recipes = await this.recipeRepo.find({
            where: { client_id: clientId },
            relations: ['product'],
            order: { recipe_name: 'ASC' },
        });

        const ingredientCounts = await this.ingredientRepo
            .createQueryBuilder('ingredient')
            .select('ingredient.recipe_id', 'recipe_id')
            .addSelect('COUNT(ingredient.id)', 'ingredient_count')
            .groupBy('ingredient.recipe_id')
            .getRawMany();

        const countMap = new Map(
            ingredientCounts.map((row) => [Number(row.recipe_id), Number(row.ingredient_count)]),
        );

        const costSummaries = await this.recipeCostingService.getRecipeCostSummaries(clientId, recipes, branchId);

        return recipes.map((recipe) => ({
            ...recipe,
            ingredient_count: countMap.get(recipe.id) ?? 0,
            cost_summary: costSummaries.get(recipe.id) ?? null,
        }));
    }

    async findByProduct(clientId: string, productId: number, branchId?: number): Promise<any[]> {
        const recipes = await this.recipeRepo.find({
            where: { product_id: productId, client_id: clientId },
            relations: ['product'],
            order: { recipe_name: 'ASC' },
        });
        const costSummaries = await this.recipeCostingService.getRecipeCostSummaries(clientId, recipes, branchId);
        return recipes.map((recipe) => ({
            ...recipe,
            cost_summary: costSummaries.get(recipe.id) ?? null,
        }));
    }

    async getRecipeDetails(clientId: string, recipeId: number, branchId?: number) {
        const recipe = await this.recipeRepo.findOne({
            where: { id: recipeId, client_id: clientId },
            relations: ['product'],
        });
        if (!recipe) throw new NotFoundException('Recipe not found.');

        const ingredients = await this.ingredientRepo.find({
            where: { recipe_id: recipeId },
            relations: ['item'],
        });

        return {
            ...recipe,
            ingredients,
            cost_summary: await this.recipeCostingService.getRecipeCostSummary(clientId, recipeId, branchId),
        };
    }

    async getCostingOverview(clientId: string, branchId?: number) {
        const recipes = await this.recipeRepo.find({
            where: { client_id: clientId },
            relations: ['product'],
            order: { recipe_name: 'ASC' },
        });
        const costSummaries = await this.recipeCostingService.getRecipeCostSummaries(clientId, recipes, branchId);
        const products = await this.productRepo.find({
            where: { client_id: clientId },
            order: { product_name: 'ASC' },
        });
        const productSummaries = await this.recipeCostingService.getProductRecipeCostSummaries(
            clientId,
            products,
            branchId,
        );

        return {
            branch_id: branchId ?? null,
            recipes: recipes.map((recipe) => ({
                id: recipe.id,
                product_id: recipe.product_id,
                recipe_name: recipe.recipe_name,
                is_active: recipe.is_active,
                yield_quantity: recipe.yield_quantity,
                yield_uom: recipe.yield_uom,
                product: recipe.product,
                cost_summary: costSummaries.get(recipe.id) ?? null,
            })),
            products: products.map((product) => ({
                id: product.id,
                product_name: product.product_name,
                product_code: product.product_code,
                product_base_price: product.product_base_price,
                recipe_cost_summary: productSummaries.get(product.id) ?? null,
            })),
        };
    }

    async getProductCostSummary(clientId: string, productId: number, branchId?: number) {
        await this.assertProductBelongsToClient(clientId, productId);
        return this.recipeCostingService.getProductRecipeCostSummary(clientId, productId, branchId);
    }

    async getRecipeCostSummary(clientId: string, recipeId: number, branchId?: number) {
        await this.getRecipeEntity(clientId, recipeId);
        return this.recipeCostingService.getRecipeCostSummary(clientId, recipeId, branchId);
    }

    async lockRecipe(clientId: string, recipeId: number, branchId?: number) {
        const recipe = await this.getRecipeEntity(clientId, recipeId);
        const summary = await this.recipeCostingService.getRecipeCostSummary(clientId, recipeId, branchId);
        if (!summary || summary.cost_status !== 'complete') {
            throw new BadRequestException('Recipe can only be locked after all ingredient costs are resolved.');
        }
        recipe.is_locked = true;
        recipe.locked_at = new Date();
        recipe.locked_total_cost = summary.total_recipe_cost;
        await this.recipeRepo.save(recipe);
        return this.getRecipeDetails(clientId, recipeId, branchId);
    }

    async unlockRecipe(clientId: string, recipeId: number) {
        const recipe = await this.getRecipeEntity(clientId, recipeId);
        recipe.is_locked = false;
        recipe.locked_at = null;
        recipe.locked_total_cost = null;
        await this.recipeRepo.save(recipe);
        return this.getRecipeDetails(clientId, recipeId);
    }
}
