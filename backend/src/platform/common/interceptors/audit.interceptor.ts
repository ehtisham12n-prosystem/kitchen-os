import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../audit/audit.service';
import { StructuredLoggerService } from '../services/structured-logger.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
    constructor(
        private readonly auditService: AuditService,
        private readonly logger: StructuredLoggerService,
    ) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const { method, url, body, ip, user } = request;

        // Only log state-changing operations
        if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
            return next.handle();
        }

        return next.handle().pipe(
            tap({
                next: (data) => {
                    this.writeAuditLog(request, {
                        entityId: data?.id !== undefined && data?.id !== null ? String(data.id) : null,
                        status: 'success',
                        details: `Action completed on ${this.deriveEntityFromUrl(url)}`,
                        responseId: data?.id ?? null,
                    });
                },
                error: (error) => {
                    const statusCode = error instanceof HttpException
                        ? error.getStatus()
                        : HttpStatus.INTERNAL_SERVER_ERROR;
                    this.writeAuditLog(request, {
                        entityId: null,
                        status: statusCode >= 500 ? 'error' : 'warning',
                        details: error instanceof Error ? error.message : 'Write request failed',
                        responseId: null,
                    });
                },
            }),
        );
    }

    private writeAuditLog(
        request: any,
        input: {
            entityId: string | null;
            status: 'success' | 'warning' | 'error';
            details: string;
            responseId: unknown;
        },
    ) {
        const { method, url, body, ip, user } = request;
        const entity = this.deriveEntityFromUrl(url);
        const action = this.deriveActionFromMethod(method, url);
        const branchId = request.activeBranchId ?? body?.branch_id ?? user?.branch_id;

        this.auditService.createLog({
            userId: user?.userId?.toString() || user?.sub?.toString() || null,
            UserManagementName: user?.email || 'System Auto',
            UserManagementRole: user?.role || 'System',
            actorType: user?.is_system ? 'system' : user?.user_type || 'system',
            clientId: user?.client_id || null,
            branchId: branchId || null,
            entityId: input.entityId,
            requestMethod: method,
            requestPath: url,
            action,
            entity,
            portal: this.derivePortal(url),
            ipAddress: ip,
            status: input.status,
            details: input.details,
            metadataJson: JSON.stringify({
                url,
                method,
                actor_type: user?.is_system ? 'system' : user?.user_type || 'system',
                client_id: user?.client_id,
                branch_id: branchId,
                request_method: method,
                request_path: url,
                request_id: request.requestId || null,
                browser: request.headers['user-agent'],
                session_id: user?.session_id ?? user?.jti ?? null,
                payload: body,
                response_id: input.responseId,
            })
        }).catch((err) => this.logger.error('Audit log write failed', {
            request_id: request.requestId || null,
            method,
            path: url,
            reason: err instanceof Error ? err.message : 'unknown',
        }));
    }

    private deriveEntityFromUrl(url: string): string {
        const segments = url.split('/').filter(Boolean);
        // e.g. /v1/platform/clients -> clients
        return segments[2] || 'System';
    }

    private deriveActionFromMethod(method: string, url: string): string {
        if (method === 'DELETE') return 'Delete';
        if (url.includes('status')) return 'Status Update';
        if (method === 'PUT' || method === 'PATCH') return 'Update';
        if (method === 'POST') return 'Create';
        return 'Action';
    }

    private derivePortal(url: string): 'Nexus' | 'Console' | 'Terminal' {
        if (url.includes('/v1/pos')) return 'Terminal';
        if (url.includes('/v1/platform')) return 'Nexus';
        return 'Console';
    }
}
