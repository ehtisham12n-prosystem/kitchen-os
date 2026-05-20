import { Controller, Get, UseGuards, Query, ParseIntPipe } from '@nestjs/common';
import { AiAnalyticsService } from './ai-analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireFeature } from '../auth/decorators/feature-entitlement.decorator';
import { RequestUser } from '../auth/decorators/user.decorator';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { APP_PERMISSIONS } from '../auth/constants/permissions';
import { getAccessibleBranchIds, requireBranchId, requireClientId } from '../auth/request-context.util';

@Controller('v1/analytics')
@UseGuards(JwtAuthGuard)
@RequireFeature('analytics', 'analytics reporting')
export class AiAnalyticsController {
    constructor(private readonly aiService: AiAnalyticsService) { }

    @Get('sales-forecast')
    @RequirePermissions(
        APP_PERMISSIONS.POS.REPORTS,
        APP_PERMISSIONS.INVENTORY.READ,
    )
    async getForecast(
        @RequestUser() user: JwtPayload,
        @Query('branchId') branchId?: string,
    ): Promise<any> {
        const targetBranch = branchId ? parseInt(branchId, 10) : requireBranchId(user);
        return this.aiService.getSalesForecast(
            requireClientId(user),
            targetBranch,
            getAccessibleBranchIds(user),
        );
    }

    @Get('recommendations/overview')
    @RequirePermissions(
        APP_PERMISSIONS.POS.REPORTS,
        APP_PERMISSIONS.INVENTORY.READ,
    )
    async getRecommendationOverview(
        @RequestUser() user: JwtPayload,
        @Query('branchId', new ParseIntPipe({ optional: true })) branchId?: number,
    ): Promise<any> {
        const targetBranch = branchId ?? requireBranchId(user);
        return this.aiService.getRecommendationOverview(
            requireClientId(user),
            targetBranch,
            getAccessibleBranchIds(user),
        );
    }

    @Get('recommendations/reorder')
    @RequirePermissions(
        APP_PERMISSIONS.POS.REPORTS,
        APP_PERMISSIONS.INVENTORY.READ,
    )
    async getReorderRecommendations(
        @RequestUser() user: JwtPayload,
        @Query('branchId', new ParseIntPipe({ optional: true })) branchId?: number,
    ): Promise<any> {
        const targetBranch = branchId ?? requireBranchId(user);
        return this.aiService.getReorderRecommendations(
            requireClientId(user),
            targetBranch,
            getAccessibleBranchIds(user),
        );
    }

    @Get('waste-analysis')
    @RequirePermissions(
        APP_PERMISSIONS.POS.REPORTS,
        APP_PERMISSIONS.INVENTORY.READ,
    )
    async getWaste(
        @RequestUser() user: JwtPayload,
        @Query('branchId', new ParseIntPipe({ optional: true })) branchId?: number,
    ): Promise<any> {
        const targetBranch = branchId ?? requireBranchId(user);
        return this.aiService.getWasteAnalytics(
            requireClientId(user),
            targetBranch,
            getAccessibleBranchIds(user),
        );
    }
}
