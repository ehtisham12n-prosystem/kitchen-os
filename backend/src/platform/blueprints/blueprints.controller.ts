import {
  Body,
  Controller,
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
import { BlueprintsService } from './blueprints.service';
import {
  AssignBlueprintDto,
  CreateBlueprintDto,
  CreateBlueprintVersionDto,
  UpdateBlueprintDto,
} from './dto/blueprint.dto';

@Controller('v1/platform')
@UseGuards(JwtAuthGuard, SystemOnlyGuard)
@RequirePermissions(APP_PERMISSIONS.PLATFORM.SUPER_ADMIN)
export class BlueprintsController {
  constructor(private readonly blueprintsService: BlueprintsService) {}

  @Get('blueprints')
  listBlueprints() {
    return this.blueprintsService.listBlueprints();
  }

  @Get('blueprints/:id')
  getBlueprint(@Param('id') id: string) {
    return this.blueprintsService.getBlueprint(id);
  }

  @Post('blueprints')
  createBlueprint(@Body() dto: CreateBlueprintDto, @RequestUser() user: JwtPayload) {
    return this.blueprintsService.createBlueprint(dto, user);
  }

  @Put('blueprints/:id')
  updateBlueprint(
    @Param('id') id: string,
    @Body() dto: UpdateBlueprintDto,
    @RequestUser() user: JwtPayload,
  ) {
    return this.blueprintsService.updateBlueprint(id, dto, user);
  }

  @Patch('blueprints/:id/status')
  updateBlueprintStatus(
    @Param('id') id: string,
    @Body() dto: { status: 'draft' | 'active' | 'retired' },
    @RequestUser() user: JwtPayload,
  ) {
    return this.blueprintsService.updateBlueprintStatus(id, dto.status, user);
  }

  @Post('blueprints/:id/versions')
  createBlueprintVersion(
    @Param('id') id: string,
    @Body() dto: CreateBlueprintVersionDto,
    @RequestUser() user: JwtPayload,
  ) {
    return this.blueprintsService.createBlueprintVersion(id, dto, user);
  }

  @Post('blueprints/:id/versions/:versionId/activate')
  activateBlueprintVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @RequestUser() user: JwtPayload,
  ) {
    return this.blueprintsService.activateBlueprintVersion(id, Number(versionId), user);
  }

  @Get('clients/:id/blueprint-assignment')
  getClientBlueprintAssignment(@Param('id') id: string) {
    return this.blueprintsService.getClientBlueprintAssignment(id);
  }

  @Get('clients/:id/blueprint-history')
  getClientBlueprintHistory(@Param('id') id: string) {
    return this.blueprintsService.getClientBlueprintHistory(id);
  }

  @Post('clients/:id/blueprint-assignment')
  assignBlueprint(
    @Param('id') id: string,
    @Body() dto: AssignBlueprintDto,
    @RequestUser() user: JwtPayload,
  ) {
    return this.blueprintsService.assignBlueprint(id, dto, user);
  }

  @Post('clients/:id/blueprint-apply')
  applyBlueprint(@Param('id') id: string, @RequestUser() user: JwtPayload) {
    return this.blueprintsService.applyBlueprint(id, user);
  }
}
