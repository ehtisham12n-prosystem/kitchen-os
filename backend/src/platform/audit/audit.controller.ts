import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequestUser } from '../../auth/decorators/user.decorator';
import { APP_PERMISSIONS } from '../../auth/constants/permissions';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import {
    assertBranchAccessible,
    getAccessibleBranchIds,
    requireClientId,
} from '../../auth/request-context.util';
import type { JwtPayload } from '../../auth/payloads/jwt-payload.interface';
import { AuditService } from './audit.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

@Controller('v1/platform/audit')
@UseGuards(JwtAuthGuard)
@RequirePermissions(APP_PERMISSIONS.ADMIN.AUDIT_READ)
export class AuditController {
    constructor(private readonly service: AuditService) { }

    @Get()
    async findAll(
        @RequestUser() user: JwtPayload,
        @Query() query: QueryAuditLogsDto,
    ) {
        const scope = this.buildScope(user, query.branch_id);
        return this.service.findAll(query, scope);
    }

    @Get(':id')
    async findById(
        @RequestUser() user: JwtPayload,
        @Param('id') id: string,
    ) {
        return this.service.findById(id, this.buildScope(user));
    }

    private buildScope(user: JwtPayload, requestedBranchId?: number) {
        const accessibleBranchIds = getAccessibleBranchIds(user);
        const scopedBranchId = requestedBranchId
            ? assertBranchAccessible(user, requestedBranchId)
            : undefined;

        return {
            isSystem: Boolean(user?.is_system),
            clientId: user?.client_id ? requireClientId(user) : undefined,
            accessibleBranchIds,
            requestedBranchId: scopedBranchId,
        };
    }
}
