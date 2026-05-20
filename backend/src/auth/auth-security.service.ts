import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { AuthAudit } from './entities/auth-audit.entity';
import { AuthSession } from './entities/auth-session.entity';
import { AuthAccessLog } from './entities/auth-access-log.entity';
import {
  addDays,
  addDuration,
  resolveAccessLogRetentionDays,
  resolveAuthAuditRetentionDays,
  resolveJwtExpiresIn,
  resolveSessionRetentionDays,
} from './security-policy.util';

type AuthAttemptInput = {
  userId: string;
  userType: 'system' | 'client' | 'customer';
  status: 'success' | 'failure';
  request?: Request | null;
  tenantSlug?: string | null;
  failureReason?: string | null;
  sessionId?: string | null;
};

type SessionCreationInput = {
  userId: string;
  username?: string | null;
  userType: 'system' | 'client' | 'customer';
  clientId?: string | null;
  branchId?: number | null;
  tenantSlug?: string | null;
  portal: 'Nexus' | 'Console' | 'Terminal' | 'Public';
  request?: Request | null;
};

@Injectable()
export class AuthSecurityService {
  private readonly jwtExpiresIn = resolveJwtExpiresIn();
  private readonly sessionRetentionDays = resolveSessionRetentionDays();
  private readonly accessLogRetentionDays = resolveAccessLogRetentionDays();
  private readonly authAuditRetentionDays = resolveAuthAuditRetentionDays();

  constructor(
    @InjectRepository(AuthAudit)
    private readonly authAuditRepo: Repository<AuthAudit>,
    @InjectRepository(AuthSession)
    private readonly authSessionRepo: Repository<AuthSession>,
    @InjectRepository(AuthAccessLog)
    private readonly authAccessLogRepo: Repository<AuthAccessLog>,
  ) {}

  async logAuthAttempt(input: AuthAttemptInput) {
    const now = new Date();

    const auditEntry = new AuthAudit();
    auditEntry.user_id = input.userId;
    auditEntry.user_type = input.userType;
    auditEntry.attempt_status = input.status;
    auditEntry.ip_address = this.getRequestIp(input.request);
    auditEntry.UserManagement_agent = this.getUserAgent(input.request);
    auditEntry.tenant_slug = input.tenantSlug ?? null;
    auditEntry.failure_reason = input.failureReason ?? null;
    auditEntry.session_id = input.sessionId ?? null;
    auditEntry.request_id = this.getRequestId(input.request);
    auditEntry.retention_until = addDays(now, this.authAuditRetentionDays);

    await this.authAuditRepo.save(auditEntry);
  }

  async createSession(input: SessionCreationInput) {
    const now = new Date();
    const sessionId = randomUUID();
    const session = this.authSessionRepo.create({
      session_id: sessionId,
      user_id: input.userId,
      username: input.username ?? null,
      user_type: input.userType,
      client_id: input.clientId ?? null,
      branch_id: input.branchId ?? null,
      tenant_slug: input.tenantSlug ?? null,
      portal: input.portal,
      ip_address: this.getRequestIp(input.request),
      user_agent: this.getUserAgent(input.request),
      device_label: this.deriveDeviceLabel(this.getUserAgent(input.request)),
      status: 'active',
      expires_at: addDuration(now, this.jwtExpiresIn),
      last_seen_at: now,
      last_seen_ip: this.getRequestIp(input.request),
      last_seen_user_agent: this.getUserAgent(input.request),
      last_seen_path: this.getRequestPath(input.request),
      request_id: this.getRequestId(input.request),
      retention_until: addDays(now, this.sessionRetentionDays),
    });

    return this.authSessionRepo.save(session);
  }

  async ensureSessionActive(sessionId?: string | null) {
    if (!sessionId) {
      return null;
    }

    const session = await this.authSessionRepo.findOne({
      where: { session_id: sessionId },
    });

    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    if (session.status === 'revoked') {
      throw new UnauthorizedException('Session has been revoked');
    }

    if (session.expires_at && session.expires_at.getTime() <= Date.now()) {
      if (session.status !== 'expired') {
        await this.authSessionRepo.update(
          { session_id: sessionId },
          { status: 'expired', revoked_at: new Date(), revoke_reason: 'Session expired' },
        );
      }
      throw new UnauthorizedException('Session has expired');
    }

    return session;
  }

  async revokeSession(sessionId?: string | null, reason: string = 'Session revoked') {
    if (!sessionId) {
      return;
    }

    await this.authSessionRepo.update(
      { session_id: sessionId },
      {
        status: 'revoked',
        revoked_at: new Date(),
        revoke_reason: reason,
      },
    );
  }

  async trackRequestAccess(request: any, statusCode: number) {
    const sessionId = request?.user?.session_id ?? request?.user?.jti ?? null;
    const userId = request?.user?.sub ?? request?.user?.userId ?? null;
    const username = request?.user?.username ?? null;

    if (!sessionId || !userId) {
      return;
    }

    const now = new Date();
    const ipAddress = this.getRequestIp(request);
    const userAgent = this.getUserAgent(request);
    const requestPath = this.getRequestPath(request);

    await Promise.all([
      this.authSessionRepo.update(
        { session_id: sessionId },
        {
          last_seen_at: now,
          last_seen_ip: ipAddress,
          last_seen_user_agent: userAgent,
          last_seen_path: requestPath,
        },
      ),
      this.authAccessLogRepo.save(this.authAccessLogRepo.create({
        session_id: sessionId,
        request_id: this.getRequestId(request),
        user_id: String(userId),
        username,
        user_type: request?.user?.user_type ?? null,
        client_id: request?.user?.client_id ?? null,
        branch_id: request?.activeBranchId ?? request?.user?.branch_id ?? null,
        portal: this.derivePortal(requestPath),
        request_method: request?.method ?? 'GET',
        request_path: requestPath,
        status_code: statusCode,
        ip_address: ipAddress,
        user_agent: userAgent,
        retention_until: addDays(now, this.accessLogRetentionDays),
      })),
    ]);
  }

  getPolicySnapshot() {
    return {
      jwt_expires_in: this.jwtExpiresIn,
      session_retention_days: this.sessionRetentionDays,
      access_log_retention_days: this.accessLogRetentionDays,
      auth_audit_retention_days: this.authAuditRetentionDays,
      ip_capture_enabled: true,
      device_capture_enabled: true,
      session_revocation_enabled: true,
      audit_export_ready: true,
    };
  }

  private getRequestIp(request?: Request | null): string | null {
    const forwardedFor = request?.headers?.['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
      return forwardedFor.split(',')[0]?.trim() || null;
    }

    if (Array.isArray(forwardedFor) && forwardedFor[0]) {
      return String(forwardedFor[0]).trim() || null;
    }

    const realIp = request?.headers?.['x-real-ip'];
    if (typeof realIp === 'string' && realIp.trim()) {
      return realIp.trim();
    }

    return request?.ip || null;
  }

  private getUserAgent(request?: Request | null): string | null {
    const header = request?.headers?.['user-agent'];
    if (!header) {
      return null;
    }

    return Array.isArray(header) ? header.join(' ') : String(header);
  }

  private getRequestId(request?: Request | null): string | null {
    const requestId = (request as Request & { requestId?: string })?.requestId;
    return requestId ? String(requestId) : null;
  }

  private getRequestPath(request?: Request | null): string {
    return (request as any)?.originalUrl || request?.url || '/';
  }

  private deriveDeviceLabel(userAgent?: string | null): string | null {
    if (!userAgent) {
      return null;
    }

    const normalized = userAgent.toLowerCase();
    const device =
      normalized.includes('iphone') ? 'iPhone' :
        normalized.includes('ipad') ? 'iPad' :
          normalized.includes('android') ? 'Android' :
            normalized.includes('windows') ? 'Windows' :
              normalized.includes('mac os') || normalized.includes('macintosh') ? 'macOS' :
                normalized.includes('linux') ? 'Linux' :
                  'Unknown device';
    const browser =
      normalized.includes('edg/') ? 'Edge' :
        normalized.includes('chrome/') ? 'Chrome' :
          normalized.includes('firefox/') ? 'Firefox' :
            normalized.includes('safari/') && !normalized.includes('chrome/') ? 'Safari' :
              'Browser';

    return `${device} / ${browser}`;
  }

  private derivePortal(path?: string): 'Nexus' | 'Console' | 'Terminal' | 'Public' {
    if (!path) {
      return 'Public';
    }

    if (path.includes('/v1/platform')) {
      return 'Nexus';
    }

    if (path.includes('/v1/pos')) {
      return 'Terminal';
    }

    if (path.includes('/v1/health') || path.includes('/v1/auth')) {
      return 'Public';
    }

    return 'Console';
  }
}
