import { Injectable } from '@nestjs/common';
import type { JwtPayload } from '../../auth/payloads/jwt-payload.interface';
import { resolveActorId } from '../../auth/request-context.util';
import { AuditService } from './audit.service';

type AuditPortal = 'Nexus' | 'Console' | 'Terminal';

interface OperationalAuditInput {
  user?: JwtPayload;
  action: string;
  entity: string;
  clientId?: string;
  branchId?: number;
  entityId?: string | number;
  portal?: AuditPortal;
  details?: string;
  requestMethod?: string;
  requestPath?: string;
  metadata?: Record<string, unknown>;
  diff?: Array<{ field: string; oldValue: unknown; newValue: unknown }>;
}

@Injectable()
export class OperationalAuditService {
  constructor(private readonly auditService: AuditService) {}

  async log(input: OperationalAuditInput): Promise<void> {
    try {
      await this.auditService.createLog({
        userId: resolveActorId(input.user),
        UserManagementName: input.user?.email || input.user?.username || 'System',
        UserManagementRole: String(input.user?.role || input.user?.user_type || 'System'),
        actorType: input.user?.is_system ? 'system' : String(input.user?.user_type || 'system'),
        clientId: input.clientId ?? input.user?.client_id ?? null,
        branchId: input.branchId ?? input.user?.active_branch_id ?? input.user?.branch_id ?? null,
        entityId: input.entityId !== undefined && input.entityId !== null ? String(input.entityId) : null,
        requestMethod: input.requestMethod || null,
        requestPath: input.requestPath || null,
        action: input.action,
        entity: input.entity,
        portal: input.portal || 'Console',
        status: 'success',
        details: input.details,
        diffJson: input.diff?.length ? JSON.stringify(input.diff) : undefined,
        metadataJson: JSON.stringify({
          actor_type: input.user?.is_system ? 'system' : String(input.user?.user_type || 'system'),
          client_id: input.clientId ?? input.user?.client_id ?? null,
          branch_id: input.branchId ?? input.user?.active_branch_id ?? input.user?.branch_id ?? null,
          entity_id: input.entityId,
          request_method: input.requestMethod || null,
          request_path: input.requestPath || null,
          ...input.metadata,
        }),
      });
    } catch (error) {
      console.error('[OperationalAuditService] Failed to create audit log:', error);
    }
  }
}
