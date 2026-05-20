import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SystemOnlyGuard } from '../../auth/guards/system-only.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { APP_PERMISSIONS } from '../../auth/constants/permissions';
import { SupportWorkspaceService } from './support-workspace.service';

@Controller('v1/platform/support')
@UseGuards(JwtAuthGuard, SystemOnlyGuard)
@RequirePermissions(APP_PERMISSIONS.PLATFORM.SUPPORT_READ)
export class SupportWorkspaceController {
  constructor(private readonly supportWorkspaceService: SupportWorkspaceService) {}

  @Get('dashboard')
  getDashboard() {
    return this.supportWorkspaceService.getDashboard();
  }

  @Get('issues-summary')
  getIssuesSummary() {
    return this.supportWorkspaceService.getIssuesSummary();
  }

  @Get('clients/:id/summary')
  getClientSummary(@Param('id') id: string) {
    return this.supportWorkspaceService.getClientSummary(id);
  }

  @Get('clients/:id/diagnostics')
  getClientDiagnostics(@Param('id') id: string) {
    return this.supportWorkspaceService.getClientDiagnostics(id);
  }
}
