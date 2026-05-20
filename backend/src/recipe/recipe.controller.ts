import {
    Controller,
    Post,
    Get,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
} from '@nestjs/common';
import { RecipeService } from './recipe.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { APP_PERMISSIONS } from '../auth/constants/permissions';
import { RequireFeature } from '../auth/decorators/feature-entitlement.decorator';
import { RequireAnyPermissions } from '../auth/decorators/permissions.decorator';
import { RequestUser } from '../auth/decorators/user.decorator';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import { getOptionalBranchId } from '../auth/request-context.util';
import {
    CreateRecipeDto,
    RecipeCostQueryDto,
    RecipeIngredientWriteDto,
    UpdateRecipeDto,
} from './dto/recipe.dto';

@Controller('v1/recipes')
@UseGuards(JwtAuthGuard)
@RequireFeature('recipe', 'recipe management')
export class RecipeController {
    constructor(private readonly recipeService: RecipeService) { }

    @Post()
    @RequireAnyPermissions(APP_PERMISSIONS.CATALOG.WRITE, APP_PERMISSIONS.CATALOG.RECIPE_WRITE)
    async createRecipe(@RequestUser() user: JwtPayload, @Body() body: CreateRecipeDto) {
        return this.recipeService.createRecipe(user.client_id!, body);
    }

    @Post(':id/ingredients')
    @RequireAnyPermissions(APP_PERMISSIONS.CATALOG.WRITE, APP_PERMISSIONS.CATALOG.RECIPE_WRITE)
    async addIngredient(
        @RequestUser() user: JwtPayload,
        @Param('id') recipeId: number,
        @Body() body: RecipeIngredientWriteDto,
    ) {
        return this.recipeService.addIngredient(user.client_id!, recipeId, body);
    }

    @Put(':id')
    @RequireAnyPermissions(APP_PERMISSIONS.CATALOG.WRITE, APP_PERMISSIONS.CATALOG.RECIPE_WRITE)
    async updateRecipe(
        @RequestUser() user: JwtPayload,
        @Param('id') recipeId: number,
        @Body() body: UpdateRecipeDto,
    ) {
        return this.recipeService.updateRecipe(user.client_id!, recipeId, body);
    }

    @Delete(':id')
    @RequireAnyPermissions(APP_PERMISSIONS.CATALOG.WRITE, APP_PERMISSIONS.CATALOG.RECIPE_WRITE)
    async deleteRecipe(
        @RequestUser() user: JwtPayload,
        @Param('id') recipeId: number,
    ) {
        return this.recipeService.deleteRecipe(user.client_id!, recipeId);
    }

    @Post(':id/lock')
    @RequireAnyPermissions(APP_PERMISSIONS.CATALOG.WRITE, APP_PERMISSIONS.CATALOG.RECIPE_WRITE)
    async lockRecipe(
        @RequestUser() user: JwtPayload,
        @Param('id') recipeId: number,
        @Query() query: RecipeCostQueryDto,
    ) {
        return this.recipeService.lockRecipe(
            user.client_id!,
            recipeId,
            getOptionalBranchId(user, query.branch_id),
        );
    }

    @Post(':id/unlock')
    @RequireAnyPermissions(APP_PERMISSIONS.CATALOG.WRITE, APP_PERMISSIONS.CATALOG.RECIPE_WRITE)
    async unlockRecipe(
        @RequestUser() user: JwtPayload,
        @Param('id') recipeId: number,
    ) {
        return this.recipeService.unlockRecipe(user.client_id!, recipeId);
    }

    @Put(':id/ingredients/:ingredientId')
    @RequireAnyPermissions(APP_PERMISSIONS.CATALOG.WRITE, APP_PERMISSIONS.CATALOG.RECIPE_WRITE)
    async updateIngredient(
        @RequestUser() user: JwtPayload,
        @Param('id') recipeId: number,
        @Param('ingredientId') ingredientId: number,
        @Body() body: RecipeIngredientWriteDto,
    ) {
        return this.recipeService.updateIngredient(user.client_id!, recipeId, ingredientId, body);
    }

    @Delete(':id/ingredients/:ingredientId')
    @RequireAnyPermissions(APP_PERMISSIONS.CATALOG.WRITE, APP_PERMISSIONS.CATALOG.RECIPE_WRITE)
    async deleteIngredient(
        @RequestUser() user: JwtPayload,
        @Param('id') recipeId: number,
        @Param('ingredientId') ingredientId: number,
    ) {
        return this.recipeService.removeIngredient(user.client_id!, recipeId, ingredientId);
    }

    @Get()
    @RequireAnyPermissions(APP_PERMISSIONS.CATALOG.READ, APP_PERMISSIONS.CATALOG.WRITE, APP_PERMISSIONS.CATALOG.RECIPE_READ, APP_PERMISSIONS.CATALOG.RECIPE_WRITE)
    async findAll(@RequestUser() user: JwtPayload, @Query() query: RecipeCostQueryDto) {
        return this.recipeService.findAll(user.client_id!, getOptionalBranchId(user, query.branch_id));
    }

    @Get('product/:productId')
    @RequireAnyPermissions(APP_PERMISSIONS.CATALOG.READ, APP_PERMISSIONS.CATALOG.WRITE, APP_PERMISSIONS.CATALOG.RECIPE_READ, APP_PERMISSIONS.CATALOG.RECIPE_WRITE)
    async findByProduct(
        @RequestUser() user: JwtPayload,
        @Param('productId') productId: number,
        @Query() query: RecipeCostQueryDto,
    ) {
        return this.recipeService.findByProduct(
            user.client_id!,
            productId,
            getOptionalBranchId(user, query.branch_id),
        );
    }

    @Get('costing/overview')
    @RequireAnyPermissions(APP_PERMISSIONS.CATALOG.READ, APP_PERMISSIONS.CATALOG.WRITE, APP_PERMISSIONS.CATALOG.RECIPE_READ, APP_PERMISSIONS.CATALOG.RECIPE_WRITE)
    async getCostingOverview(@RequestUser() user: JwtPayload, @Query() query: RecipeCostQueryDto) {
        return this.recipeService.getCostingOverview(
            user.client_id!,
            getOptionalBranchId(user, query.branch_id),
        );
    }

    @Get('product/:productId/costing')
    @RequireAnyPermissions(APP_PERMISSIONS.CATALOG.READ, APP_PERMISSIONS.CATALOG.WRITE, APP_PERMISSIONS.CATALOG.RECIPE_READ, APP_PERMISSIONS.CATALOG.RECIPE_WRITE)
    async getProductCosting(
        @RequestUser() user: JwtPayload,
        @Param('productId') productId: number,
        @Query() query: RecipeCostQueryDto,
    ) {
        return this.recipeService.getProductCostSummary(
            user.client_id!,
            productId,
            getOptionalBranchId(user, query.branch_id),
        );
    }

    @Get(':id')
    @RequireAnyPermissions(APP_PERMISSIONS.CATALOG.READ, APP_PERMISSIONS.CATALOG.WRITE, APP_PERMISSIONS.CATALOG.RECIPE_READ, APP_PERMISSIONS.CATALOG.RECIPE_WRITE)
    async getDetails(
        @RequestUser() user: JwtPayload,
        @Param('id') recipeId: number,
        @Query() query: RecipeCostQueryDto,
    ) {
        return this.recipeService.getRecipeDetails(
            user.client_id!,
            recipeId,
            getOptionalBranchId(user, query.branch_id),
        );
    }

    @Get(':id/costing')
    @RequireAnyPermissions(APP_PERMISSIONS.CATALOG.READ, APP_PERMISSIONS.CATALOG.WRITE, APP_PERMISSIONS.CATALOG.RECIPE_READ, APP_PERMISSIONS.CATALOG.RECIPE_WRITE)
    async getRecipeCosting(
        @RequestUser() user: JwtPayload,
        @Param('id') recipeId: number,
        @Query() query: RecipeCostQueryDto,
    ) {
        return this.recipeService.getRecipeCostSummary(
            user.client_id!,
            recipeId,
            getOptionalBranchId(user, query.branch_id),
        );
    }
}
