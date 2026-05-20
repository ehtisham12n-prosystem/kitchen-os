import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { StructuredLoggerService } from '../services/structured-logger.service';
import { AuthSecurityService } from '../../../auth/auth-security.service';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: StructuredLoggerService,
    private readonly authSecurityService: AuthSecurityService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<any>();
    const response = http.getResponse<any>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.writeRequestLog(request, response?.statusCode, startedAt);
        },
        error: (error) => {
          const statusCode = error instanceof HttpException
            ? error.getStatus()
            : HttpStatus.INTERNAL_SERVER_ERROR;
          this.writeRequestLog(request, statusCode, startedAt);
        },
      }),
    );
  }

  private writeRequestLog(request: any, statusCode: number, startedAt: number) {
    const path = request?.originalUrl || request?.url;
    const payload = {
      request_id: request?.requestId || null,
      method: request?.method,
      path,
      status_code: statusCode,
      duration_ms: Date.now() - startedAt,
      client_id: request?.user?.client_id || null,
      branch_id: request?.activeBranchId ?? request?.user?.branch_id ?? null,
      actor_id: request?.user?.sub ?? null,
      portal: this.derivePortal(path),
    };

    if (statusCode >= 500) {
      this.logger.error('HTTP request completed', payload);
    } else if (statusCode >= 400) {
      this.logger.warn('HTTP request completed', payload);
    } else {
      this.logger.log('HTTP request completed', payload);
    }

    this.authSecurityService.trackRequestAccess(request, statusCode).catch((error) => {
      this.logger.warn('Security access log write failed', {
        request_id: request?.requestId || null,
        path,
        reason: error instanceof Error ? error.message : 'unknown',
      });
    });
  }

  private derivePortal(url?: string): 'Nexus' | 'Console' | 'Terminal' | 'Public' {
    if (!url) return 'Public';
    if (url.includes('/v1/pos')) return 'Terminal';
    if (url.includes('/v1/platform')) return 'Nexus';
    if (url.includes('/v1/health')) return 'Public';
    return 'Console';
  }
}
