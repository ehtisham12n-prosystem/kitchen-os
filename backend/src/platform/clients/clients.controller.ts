import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SystemOnlyGuard } from '../../auth/guards/system-only.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { APP_PERMISSIONS } from '../../auth/constants/permissions';
import { Public } from '../../auth/decorators/public.decorator';
import { RequestUser } from '../../auth/decorators/user.decorator';
import type { JwtPayload } from '../../auth/payloads/jwt-payload.interface';
import { ClientsService } from './clients.service';
import { ClientGovernanceService } from './client-governance.service';
import {
  AssignClientSubscriptionDto,
  UpdateClientSubscriptionStatusDto,
} from '../dto/client-subscription.dto';
import { ChangeClientGovernanceDto } from './dto/client-governance.dto';
import {
  ChangeClientStatusDto,
  CreateClientRegistryDto,
  UpdateClientRegistryDto,
} from './dto/client-registry.dto';
import {
  CLIENT_BRANDING_ASSET_KEYS,
  type ClientBrandingAssetKey,
  UpdateClientBrandingDto,
} from './dto/client-branding.dto';
import { normalizeClientIdentifier } from '../client-lookup.util';

@Controller('v1/platform/clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly clientGovernanceService: ClientGovernanceService,
  ) {}

  private canAccessClient(id: string, user: JwtPayload | undefined): boolean {
    if (user?.is_system) {
      return true;
    }

    if (!user?.client_id) {
      return false;
    }

    return normalizeClientIdentifier(user.client_id) === normalizeClientIdentifier(id);
  }

  @Get()
  @UseGuards(SystemOnlyGuard)
  @RequirePermissions(APP_PERMISSIONS.PLATFORM.SUPER_ADMIN)
  findAll(
    @Query('name') name?: string,
    @Query('status') status?: string,
  ) {
    return this.clientsService.findAll({ name, status });
  }

  @Public()
  @Get('by-slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.clientsService.findBySlug(slug);
  }

  @Get(':id/subscription-summary')
  getSubscriptionSummary(@Param('id') id: string, @RequestUser() user: JwtPayload) {
    if (this.canAccessClient(id, user)) {
      return this.clientsService.getSubscriptionSummary(id);
    }
    throw new ForbiddenException('You do not have access to this client');
  }

  @Get(':id')
  findOne(@Param('id') id: string, @RequestUser() user: JwtPayload) {
    if (this.canAccessClient(id, user)) {
      return this.clientsService.findOne(id);
    }
    throw new ForbiddenException('You do not have access to this client');
  }

  @Post()
  @UseGuards(SystemOnlyGuard)
  @RequirePermissions(APP_PERMISSIONS.PLATFORM.SUPER_ADMIN)
  create(@Body() dto: CreateClientRegistryDto, @RequestUser() user: JwtPayload) {
    return this.clientsService.create(dto, user);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClientRegistryDto,
    @RequestUser() user: JwtPayload,
  ) {
    if (!this.canAccessClient(id, user)) {
      throw new ForbiddenException('You do not have access to this client');
    }
    return this.clientsService.update(id, dto, user);
  }

  @Get(':id/branding')
  getBranding(@Param('id') id: string, @RequestUser() user: JwtPayload) {
    if (this.canAccessClient(id, user)) {
      return this.clientsService.getBranding(id);
    }
    throw new ForbiddenException('You do not have access to this client');
  }

  @Put(':id/branding')
  updateBranding(
    @Param('id') id: string,
    @Body() dto: UpdateClientBrandingDto,
    @RequestUser() user: JwtPayload,
  ) {
    if (!this.canAccessClient(id, user)) {
      throw new ForbiddenException('You do not have access to this client');
    }
    return this.clientsService.updateBranding(id, dto, user);
  }

  @Post(':id/branding/assets/:assetKey')
  @UseInterceptors(FileInterceptor('file'))
  uploadBrandingAsset(
    @Param('id') id: string,
    @Param('assetKey') assetKey: string,
    @UploadedFile() file: any,
    @RequestUser() user: JwtPayload,
  ) {
    if (!this.canAccessClient(id, user)) {
      throw new ForbiddenException('You do not have access to this client');
    }
    if (!CLIENT_BRANDING_ASSET_KEYS.includes(assetKey as ClientBrandingAssetKey)) {
      throw new BadRequestException('Unsupported branding asset key');
    }
    return this.clientsService.uploadBrandingAsset(id, assetKey as ClientBrandingAssetKey, file, user);
  }

  @Patch(':id/status')
  @UseGuards(SystemOnlyGuard)
  @RequirePermissions(APP_PERMISSIONS.PLATFORM.SUPER_ADMIN)
  changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeClientStatusDto,
    @RequestUser() user: JwtPayload,
  ) {
    return this.clientsService.changeStatus(id, dto, user);
  }

  @Get(':id/status-history')
  @UseGuards(SystemOnlyGuard)
  @RequirePermissions(APP_PERMISSIONS.PLATFORM.SUPER_ADMIN)
  getStatusHistory(@Param('id') id: string) {
    return this.clientsService.getStatusHistory(id);
  }

  @Get(':id/current-subscription')
  @UseGuards(SystemOnlyGuard)
  @RequirePermissions(APP_PERMISSIONS.PLATFORM.SUPER_ADMIN)
  getCurrentSubscription(@Param('id') id: string) {
    return this.clientsService.getCurrentSubscription(id);
  }

  @Get(':id/subscriptions')
  @UseGuards(SystemOnlyGuard)
  @RequirePermissions(APP_PERMISSIONS.PLATFORM.SUPER_ADMIN)
  getSubscriptions(@Param('id') id: string) {
    return this.clientsService.getSubscriptions(id);
  }

  @Post(':id/subscriptions')
  @UseGuards(SystemOnlyGuard)
  @RequirePermissions(APP_PERMISSIONS.PLATFORM.SUPER_ADMIN)
  assignSubscription(
    @Param('id') id: string,
    @Body() dto: AssignClientSubscriptionDto,
    @RequestUser() user: JwtPayload,
  ) {
    return this.clientsService.assignSubscription(id, dto, user);
  }

  @Patch(':id/subscriptions/:subscriptionId/status')
  @UseGuards(SystemOnlyGuard)
  @RequirePermissions(APP_PERMISSIONS.PLATFORM.SUPER_ADMIN)
  updateSubscriptionStatus(
    @Param('id') id: string,
    @Param('subscriptionId') subscriptionId: string,
    @Body() dto: UpdateClientSubscriptionStatusDto,
    @RequestUser() user: JwtPayload,
  ) {
    return this.clientsService.updateSubscriptionStatus(id, Number(subscriptionId), dto, user);
  }

  @Get(':id/audit')
  @UseGuards(SystemOnlyGuard)
  @RequirePermissions(APP_PERMISSIONS.PLATFORM.SUPER_ADMIN)
  getAuditHistory(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.clientsService.getAuditHistory(id, limit ? Number(limit) : 50);
  }

  @Get(':id/inspection')
  @UseGuards(SystemOnlyGuard)
  @RequirePermissions(APP_PERMISSIONS.PLATFORM.SUPER_ADMIN)
  getTenantInspection(@Param('id') id: string) {
    return this.clientsService.getTenantInspection(id);
  }

  @Get(':id/governance')
  @UseGuards(SystemOnlyGuard)
  @RequirePermissions(APP_PERMISSIONS.PLATFORM.SUPER_ADMIN)
  getGovernance(@Param('id') id: string) {
    return this.clientGovernanceService.getGovernance(id);
  }

  @Get(':id/governance/history')
  @UseGuards(SystemOnlyGuard)
  @RequirePermissions(APP_PERMISSIONS.PLATFORM.SUPER_ADMIN)
  getGovernanceHistory(@Param('id') id: string) {
    return this.clientGovernanceService.getGovernanceHistory(id);
  }

  @Patch(':id/governance')
  @UseGuards(SystemOnlyGuard)
  @RequirePermissions(APP_PERMISSIONS.PLATFORM.SUPER_ADMIN)
  changeGovernance(
    @Param('id') id: string,
    @Body() dto: ChangeClientGovernanceDto,
    @RequestUser() user: JwtPayload,
  ) {
    return this.clientGovernanceService.changeGovernance(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(SystemOnlyGuard)
  @RequirePermissions(APP_PERMISSIONS.PLATFORM.SUPER_ADMIN)
  suspend(@Param('id') id: string, @RequestUser() user: JwtPayload) {
    return this.clientsService.suspend(id, user);
  }

  @Post(':id/activate')
  @UseGuards(SystemOnlyGuard)
  @RequirePermissions(APP_PERMISSIONS.PLATFORM.SUPER_ADMIN)
  activate(@Param('id') id: string, @RequestUser() user: JwtPayload) {
    return this.clientsService.activate(id, user);
  }
}
