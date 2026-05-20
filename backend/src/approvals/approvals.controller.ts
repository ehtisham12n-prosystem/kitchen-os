import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { RequestUser } from '../auth/decorators/user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { APP_PERMISSIONS } from '../auth/constants/permissions';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import { requireBranchId, requireClientId } from '../auth/request-context.util';
import { ApprovalsService } from './approvals.service';

@Controller('v1/approvals')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get('inbox')
  @RequirePermissions(APP_PERMISSIONS.APPROVAL.VIEW)
  async getInbox(@RequestUser() user: JwtPayload) {
    return this.approvalsService.getInbox(requireClientId(user), requireBranchId(user));
  }

  @Post()
  @RequirePermissions(APP_PERMISSIONS.APPROVAL.CREATE)
  async submit(
    @RequestUser() user: JwtPayload,
    @Body()
    body: {
      module: string;
      entity_id: string | number;
      action_type: string;
      branch_id?: number | null;
      notes?: string | null;
    },
  ) {
    return this.approvalsService.submit({
      client_id: requireClientId(user),
      module: body.module,
      entity_id: body.entity_id,
      action_type: body.action_type,
      requested_by: user.sub,
      branch_id: body.branch_id ?? requireBranchId(user),
      notes: body.notes,
    });
  }

  @Post(':id/approve')
  @RequirePermissions(APP_PERMISSIONS.APPROVAL.APPROVE)
  async approve(
    @RequestUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { decision_notes?: string | null },
  ) {
    return this.approvalsService.decide(requireClientId(user), id, 'approved', user.sub, body.decision_notes);
  }

  @Post(':id/reject')
  @RequirePermissions(APP_PERMISSIONS.APPROVAL.REJECT)
  async reject(
    @RequestUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { decision_notes?: string | null },
  ) {
    return this.approvalsService.decide(requireClientId(user), id, 'rejected', user.sub, body.decision_notes);
  }
}
