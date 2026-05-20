import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PlatformDashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SystemOnlyGuard } from '../../auth/guards/system-only.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { APP_PERMISSIONS } from '../../auth/constants/permissions';

@Controller('v1/platform/dashboard')
@UseGuards(JwtAuthGuard, SystemOnlyGuard)
export class PlatformDashboardController {
    constructor(private readonly dashboardService: PlatformDashboardService) { }

    @Get('overview')
    @RequirePermissions(APP_PERMISSIONS.PLATFORM.SUPPORT_READ)
    getOverview() {
        return this.dashboardService.getOverview();
    }

    @Get('attention')
    @RequirePermissions(APP_PERMISSIONS.PLATFORM.SUPPORT_READ)
    getAttentionSummary() {
        return this.dashboardService.getAttentionSummary();
    }

    @Get('kpis')
    @RequirePermissions(APP_PERMISSIONS.PLATFORM.SUPPORT_READ)
    getKpis() {
        return this.dashboardService.getKpis();
    }

    @Get('revenue-trend')
    @RequirePermissions(APP_PERMISSIONS.PLATFORM.SUPPORT_READ)
    getRevenueTrend(@Query('months') months: number = 6) {
        return this.dashboardService.getRevenueTrend(months);
    }

    @Get('recent-activity')
    @RequirePermissions(APP_PERMISSIONS.PLATFORM.SUPPORT_READ)
    getRecentActivity(@Query('limit') limit: number = 10) {
        return this.dashboardService.getRecentActivity(limit);
    }

    @Get('health')
    @RequirePermissions(APP_PERMISSIONS.PLATFORM.SUPPORT_READ)
    getHealth() {
        return this.dashboardService.getHealth();
    }
}
