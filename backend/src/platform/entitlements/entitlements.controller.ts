import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SystemOnlyGuard } from '../../auth/guards/system-only.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { APP_PERMISSIONS } from '../../auth/constants/permissions';
import { RequestUser } from '../../auth/decorators/user.decorator';
import type { JwtPayload } from '../../auth/payloads/jwt-payload.interface';
import { EntitlementsService } from './entitlements.service';
import {
  CreatePlatformFeatureDto,
  UpdatePlanEntitlementsDto,
  UpdatePlanLimitsDto,
  UpdatePlatformFeatureDto,
  UpdatePlatformFeatureStatusDto,
  UpsertClientFeatureOverrideDto,
  UpsertClientLimitOverrideDto,
} from './dto/entitlements.dto';

@Controller('v1/platform')
@UseGuards(JwtAuthGuard, SystemOnlyGuard)
@RequirePermissions(APP_PERMISSIONS.PLATFORM.SUPER_ADMIN)
export class EntitlementsController {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  @Get('features')
  listFeatures() {
    return this.entitlementsService.listFeatures();
  }

  @Post('features')
  createFeature(@Body() dto: CreatePlatformFeatureDto, @RequestUser() user: JwtPayload) {
    return this.entitlementsService.createFeature(dto, user);
  }

  @Put('features/:id')
  updateFeature(
    @Param('id') id: string,
    @Body() dto: UpdatePlatformFeatureDto,
    @RequestUser() user: JwtPayload,
  ) {
    return this.entitlementsService.updateFeature(Number(id), dto, user);
  }

  @Patch('features/:id/status')
  updateFeatureStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePlatformFeatureStatusDto,
    @RequestUser() user: JwtPayload,
  ) {
    return this.entitlementsService.updateFeatureStatus(Number(id), dto, user);
  }

  @Get('plans/:id/entitlements')
  getPlanEntitlements(@Param('id') id: string) {
    return this.entitlementsService.getPlanEntitlements(Number(id));
  }

  @Put('plans/:id/entitlements')
  updatePlanEntitlements(
    @Param('id') id: string,
    @Body() dto: UpdatePlanEntitlementsDto,
    @RequestUser() user: JwtPayload,
  ) {
    return this.entitlementsService.updatePlanEntitlements(Number(id), dto, user);
  }

  @Get('plans/:id/limits')
  getPlanLimits(@Param('id') id: string) {
    return this.entitlementsService.getPlanLimits(Number(id));
  }

  @Put('plans/:id/limits')
  updatePlanLimits(
    @Param('id') id: string,
    @Body() dto: UpdatePlanLimitsDto,
    @RequestUser() user: JwtPayload,
  ) {
    return this.entitlementsService.updatePlanLimits(Number(id), dto, user);
  }

  @Get('clients/:id/effective-entitlements')
  getEffectiveEntitlements(@Param('id') id: string) {
    return this.entitlementsService.getEffectiveEntitlements(id);
  }

  @Get('clients/:id/overrides')
  getClientOverrides(@Param('id') id: string) {
    return this.entitlementsService.getClientOverrides(id);
  }

  @Post('clients/:id/feature-overrides')
  upsertClientFeatureOverride(
    @Param('id') id: string,
    @Body() dto: UpsertClientFeatureOverrideDto,
    @RequestUser() user: JwtPayload,
  ) {
    return this.entitlementsService.upsertClientFeatureOverride(id, dto, user);
  }

  @Delete('clients/:id/feature-overrides/:featureKey')
  removeClientFeatureOverride(
    @Param('id') id: string,
    @Param('featureKey') featureKey: string,
    @RequestUser() user: JwtPayload,
  ) {
    return this.entitlementsService.removeClientFeatureOverride(id, featureKey, user);
  }

  @Post('clients/:id/limit-overrides')
  upsertClientLimitOverride(
    @Param('id') id: string,
    @Body() dto: UpsertClientLimitOverrideDto,
    @RequestUser() user: JwtPayload,
  ) {
    return this.entitlementsService.upsertClientLimitOverride(id, dto, user);
  }

  @Delete('clients/:id/limit-overrides/:limitKey')
  removeClientLimitOverride(
    @Param('id') id: string,
    @Param('limitKey') limitKey: string,
    @RequestUser() user: JwtPayload,
  ) {
    return this.entitlementsService.removeClientLimitOverride(id, limitKey, user);
  }
}
