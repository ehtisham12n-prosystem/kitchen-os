import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { APP_PERMISSIONS } from '../../auth/constants/permissions';
import { RequestUser } from '../../auth/decorators/user.decorator';
import type { JwtPayload } from '../../auth/payloads/jwt-payload.interface';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SystemOnlyGuard } from '../../auth/guards/system-only.guard';
import { SecurityAdminService } from './security-admin.service';
import { QuerySecuritySessionsDto } from './dto/query-security-sessions.dto';
import { QueryAccessLogsDto } from './dto/query-access-logs.dto';

@Controller('v1/platform/security')
@UseGuards(JwtAuthGuard, SystemOnlyGuard)
export class SecurityAdminController {
  constructor(private readonly securityAdminService: SecurityAdminService) {}

  @Get('overview')
  @RequirePermissions(APP_PERMISSIONS.PLATFORM.SUPPORT_READ)
  getOverview() {
    return this.securityAdminService.getOverview();
  }

  @Get('sessions')
  @RequirePermissions(APP_PERMISSIONS.PLATFORM.SUPPORT_READ)
  getSessions(@Query() query: QuerySecuritySessionsDto) {
    return this.securityAdminService.listSessions(query);
  }

  @Get('access-logs')
  @RequirePermissions(APP_PERMISSIONS.PLATFORM.SUPPORT_READ)
  getAccessLogs(@Query() query: QueryAccessLogsDto) {
    return this.securityAdminService.listAccessLogs(query);
  }

  @Post('sessions/:sessionId/revoke')
  @RequirePermissions(APP_PERMISSIONS.PLATFORM.SUPER_ADMIN)
  revokeSession(
    @Param('sessionId') sessionId: string,
    @RequestUser() user: JwtPayload,
    @Body('reason') reason?: string,
  ) {
    return this.securityAdminService.revokeSession(sessionId, user, reason);
  }
}
