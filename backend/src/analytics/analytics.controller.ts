import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { APP_PERMISSIONS } from '../auth/constants/permissions';
import { RequireFeature } from '../auth/decorators/feature-entitlement.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { RequestUser } from '../auth/decorators/user.decorator';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import {
  getAccessibleBranchIds,
  requireClientId,
} from '../auth/request-context.util';
import { OperationsReportQueryDto } from './dto/operations-report.dto';
import { AnalyticsService } from './analytics.service';

@Controller('v1/analytics')
@UseGuards(JwtAuthGuard)
@RequireFeature('analytics', 'analytics reporting')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('operations/branch-options')
  @RequirePermissions(
    APP_PERMISSIONS.POS.REPORTS,
    APP_PERMISSIONS.INVENTORY.READ,
  )
  async getOperationsBranchOptions(@RequestUser() user: JwtPayload) {
    return this.analyticsService.getOperationsBranchOptions(
      requireClientId(user),
      getAccessibleBranchIds(user),
    );
  }

  @Get('operations/overview')
  @RequirePermissions(
    APP_PERMISSIONS.POS.REPORTS,
    APP_PERMISSIONS.INVENTORY.READ,
  )
  async getOperationsOverview(
    @RequestUser() user: JwtPayload,
    @Query() query: OperationsReportQueryDto,
  ) {
    return this.analyticsService.getOperationsOverview(
      requireClientId(user),
      getAccessibleBranchIds(user),
      query,
    );
  }

  @Get('kpi')
  @RequirePermissions(
    APP_PERMISSIONS.POS.REPORTS,
    APP_PERMISSIONS.INVENTORY.READ,
  )
  async getExecutiveKpis(
    @RequestUser() user: JwtPayload,
    @Query() query: OperationsReportQueryDto,
  ): Promise<any> {
    return this.analyticsService.getExecutiveKpis(
      requireClientId(user),
      getAccessibleBranchIds(user),
      query,
    );
  }

  @Get('menu-engineering')
  @RequirePermissions(
    APP_PERMISSIONS.POS.REPORTS,
    APP_PERMISSIONS.INVENTORY.READ,
  )
  async getMenuEngineering(
    @RequestUser() user: JwtPayload,
    @Query() query: OperationsReportQueryDto,
  ): Promise<any> {
    return this.analyticsService.getMenuEngineering(
      requireClientId(user),
      getAccessibleBranchIds(user),
      query,
    );
  }

  @Get('sales-trends')
  @RequirePermissions(APP_PERMISSIONS.POS.REPORTS)
  async getSalesTrends(
    @RequestUser() user: JwtPayload,
    @Query() query: OperationsReportQueryDto,
  ): Promise<any> {
    return this.analyticsService.getSalesTrends(
      requireClientId(user),
      getAccessibleBranchIds(user),
      query,
    );
  }

  @Get('branch')
  @RequirePermissions(
    APP_PERMISSIONS.POS.REPORTS,
    APP_PERMISSIONS.INVENTORY.READ,
  )
  async getBranchAnalytics(
    @RequestUser() user: JwtPayload,
    @Query() query: OperationsReportQueryDto,
  ): Promise<any> {
    return this.analyticsService.getBranchAnalytics(
      requireClientId(user),
      getAccessibleBranchIds(user),
      query,
    );
  }

  @Get('station')
  @RequirePermissions(
    APP_PERMISSIONS.POS.REPORTS,
    APP_PERMISSIONS.INVENTORY.READ,
  )
  async getStationAnalytics(
    @RequestUser() user: JwtPayload,
    @Query() query: OperationsReportQueryDto,
  ): Promise<any> {
    return this.analyticsService.getStationAnalytics(
      requireClientId(user),
      getAccessibleBranchIds(user),
      query,
    );
  }

  @Get('inventory')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.READ)
  async getInventoryAnalytics(
    @RequestUser() user: JwtPayload,
    @Query() query: OperationsReportQueryDto,
  ): Promise<any> {
    return this.analyticsService.getInventoryAnalytics(
      requireClientId(user),
      getAccessibleBranchIds(user),
      query,
    );
  }

  @Get('waste')
  @RequirePermissions(
    APP_PERMISSIONS.POS.REPORTS,
    APP_PERMISSIONS.INVENTORY.READ,
  )
  async getWasteAnalytics(
    @RequestUser() user: JwtPayload,
    @Query() query: OperationsReportQueryDto,
  ): Promise<any> {
    return this.analyticsService.getWasteCommandCenter(
      requireClientId(user),
      getAccessibleBranchIds(user),
      query,
    );
  }

  @Get('forecast')
  @RequirePermissions(
    APP_PERMISSIONS.POS.REPORTS,
    APP_PERMISSIONS.INVENTORY.READ,
  )
  async getForecast(
    @RequestUser() user: JwtPayload,
    @Query() query: OperationsReportQueryDto,
  ): Promise<any> {
    return this.analyticsService.getForecast(
      requireClientId(user),
      getAccessibleBranchIds(user),
      query,
    );
  }

  @Get('recommendations')
  @RequirePermissions(
    APP_PERMISSIONS.POS.REPORTS,
    APP_PERMISSIONS.INVENTORY.READ,
  )
  async getRecommendations(
    @RequestUser() user: JwtPayload,
    @Query() query: OperationsReportQueryDto,
  ): Promise<any> {
    return this.analyticsService.getRecommendations(
      requireClientId(user),
      getAccessibleBranchIds(user),
      query,
    );
  }

  @Get('command-center')
  @RequirePermissions(
    APP_PERMISSIONS.POS.REPORTS,
    APP_PERMISSIONS.INVENTORY.READ,
  )
  async getCommandCenter(
    @RequestUser() user: JwtPayload,
    @Query() query: OperationsReportQueryDto,
  ): Promise<any> {
    return this.analyticsService.getCommandCenter(
      requireClientId(user),
      getAccessibleBranchIds(user),
      query,
    );
  }

  @Get('management/kpis')
  @RequirePermissions(
    APP_PERMISSIONS.POS.REPORTS,
    APP_PERMISSIONS.INVENTORY.READ,
  )
  async getManagementKpis(
    @RequestUser() user: JwtPayload,
    @Query() query: OperationsReportQueryDto,
  ) {
    return this.analyticsService.getManagementKpis(
      requireClientId(user),
      getAccessibleBranchIds(user),
      query,
    );
  }

  @Get('management/branches/:branchId')
  @RequirePermissions(
    APP_PERMISSIONS.POS.REPORTS,
    APP_PERMISSIONS.INVENTORY.READ,
  )
  async getBranchManagementSnapshot(
    @RequestUser() user: JwtPayload,
    @Param('branchId', ParseIntPipe) branchId: number,
    @Query() query: OperationsReportQueryDto,
  ) {
    return this.analyticsService.getBranchManagementSnapshot(
      requireClientId(user),
      branchId,
      getAccessibleBranchIds(user),
      query,
    );
  }

  @Get('operations/branches/:branchId')
  @RequirePermissions(
    APP_PERMISSIONS.POS.REPORTS,
    APP_PERMISSIONS.INVENTORY.READ,
  )
  async getBranchOperationsDetail(
    @RequestUser() user: JwtPayload,
    @Param('branchId', ParseIntPipe) branchId: number,
    @Query() query: OperationsReportQueryDto,
  ) {
    return this.analyticsService.getBranchOperationsDetail(
      requireClientId(user),
      branchId,
      getAccessibleBranchIds(user),
      query,
    );
  }

  @Get('branch/:id')
  @RequirePermissions(
    APP_PERMISSIONS.POS.REPORTS,
    APP_PERMISSIONS.INVENTORY.READ,
  )
  async getBranchMetrics(
    @RequestUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: OperationsReportQueryDto,
  ) {
    return this.analyticsService.getBranchMetrics(
      requireClientId(user),
      id,
      getAccessibleBranchIds(user),
      query,
    );
  }
}
