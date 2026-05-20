import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { AuthAudit } from '../../auth/entities/auth-audit.entity';
import { AuthSession } from '../../auth/entities/auth-session.entity';
import { AuthAccessLog } from '../../auth/entities/auth-access-log.entity';
import { UserManagement } from '../../setup/entities/UserManagement.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { QuerySecuritySessionsDto } from './dto/query-security-sessions.dto';
import { QueryAccessLogsDto } from './dto/query-access-logs.dto';
import { JwtPayload } from '../../auth/payloads/jwt-payload.interface';
import { AuditService } from '../audit/audit.service';
import {
  resolveAccessLogRetentionDays,
  resolveAuthAuditRetentionDays,
  resolveJwtExpiresIn,
  resolveSessionRetentionDays,
} from '../../auth/security-policy.util';

@Injectable()
export class SecurityAdminService {
  constructor(
    @InjectRepository(AuthAudit)
    private readonly authAuditRepo: Repository<AuthAudit>,
    @InjectRepository(AuthSession)
    private readonly authSessionRepo: Repository<AuthSession>,
    @InjectRepository(AuthAccessLog)
    private readonly authAccessLogRepo: Repository<AuthAccessLog>,
    @InjectRepository(UserManagement)
    private readonly userRepo: Repository<UserManagement>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    private readonly auditService: AuditService,
  ) {}

  async getOverview() {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const next6Hours = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const staleThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      authRaw,
      sessionRaw,
      lockoutRaw,
      accessRaw,
      auditRaw,
      recentFailedLogins,
      activeSessions,
    ] = await Promise.all([
      this.authAuditRepo
        .createQueryBuilder('audit')
        .select(
          "SUM(CASE WHEN audit.attempt_status = 'success' AND audit.created_at >= :last24Hours THEN 1 ELSE 0 END)",
          'success_last_24h',
        )
        .addSelect(
          "SUM(CASE WHEN audit.attempt_status = 'failure' AND audit.created_at >= :last24Hours THEN 1 ELSE 0 END)",
          'failure_last_24h',
        )
        .addSelect(
          "COUNT(DISTINCT CASE WHEN audit.created_at >= :last24Hours THEN audit.ip_address END)",
          'unique_ips_last_24h',
        )
        .setParameters({ last24Hours })
        .getRawOne<{
          success_last_24h: string | null;
          failure_last_24h: string | null;
          unique_ips_last_24h: string | null;
        }>(),
      this.authSessionRepo
        .createQueryBuilder('session')
        .select(
          "SUM(CASE WHEN session.status = 'active' THEN 1 ELSE 0 END)",
          'active_sessions',
        )
        .addSelect(
          "SUM(CASE WHEN session.status = 'revoked' AND session.revoked_at >= :last7Days THEN 1 ELSE 0 END)",
          'revoked_last_7d',
        )
        .addSelect(
          "SUM(CASE WHEN session.status = 'active' AND session.expires_at <= :next6Hours THEN 1 ELSE 0 END)",
          'expiring_soon',
        )
        .addSelect(
          "SUM(CASE WHEN session.status = 'active' AND (session.last_seen_at IS NULL OR session.last_seen_at < :staleThreshold) THEN 1 ELSE 0 END)",
          'stale_sessions',
        )
        .addSelect(
          "SUM(CASE WHEN session.status = 'active' AND session.last_seen_ip IS NOT NULL AND session.ip_address IS NOT NULL AND session.last_seen_ip <> session.ip_address THEN 1 ELSE 0 END)",
          'ip_changed_sessions',
        )
        .setParameters({ last7Days, next6Hours, staleThreshold })
        .getRawOne<{
          active_sessions: string | null;
          revoked_last_7d: string | null;
          expiring_soon: string | null;
          stale_sessions: string | null;
          ip_changed_sessions: string | null;
        }>(),
      this.userRepo
        .createQueryBuilder('user')
        .select("SUM(CASE WHEN user.is_locked = 1 THEN 1 ELSE 0 END)", 'locked_accounts')
        .addSelect('MIN(user.wrong_attempts_limit)', 'min_lockout_limit')
        .addSelect('MAX(user.wrong_attempts_limit)', 'max_lockout_limit')
        .getRawOne<{
          locked_accounts: string | null;
          min_lockout_limit: string | null;
          max_lockout_limit: string | null;
        }>(),
      this.authAccessLogRepo
        .createQueryBuilder('access')
        .select(
          "SUM(CASE WHEN access.created_at >= :last24Hours THEN 1 ELSE 0 END)",
          'events_last_24h',
        )
        .addSelect(
          "SUM(CASE WHEN access.created_at >= :last24Hours AND access.status_code IN (401, 403) THEN 1 ELSE 0 END)",
          'denied_last_24h',
        )
        .addSelect(
          "SUM(CASE WHEN access.created_at >= :last24Hours AND access.portal = 'Nexus' THEN 1 ELSE 0 END)",
          'nexus_last_24h',
        )
        .setParameters({ last24Hours })
        .getRawOne<{
          events_last_24h: string | null;
          denied_last_24h: string | null;
          nexus_last_24h: string | null;
        }>(),
      this.auditLogRepo
        .createQueryBuilder('audit')
        .select(
          "SUM(CASE WHEN audit.timestamp >= :last7Days AND audit.status = 'warning' THEN 1 ELSE 0 END)",
          'warnings_last_7d',
        )
        .addSelect(
          "SUM(CASE WHEN audit.timestamp >= :last7Days AND audit.status = 'error' THEN 1 ELSE 0 END)",
          'errors_last_7d',
        )
        .setParameters({ last7Days })
        .getRawOne<{
          warnings_last_7d: string | null;
          errors_last_7d: string | null;
        }>(),
      this.authAuditRepo.find({
        where: { attempt_status: 'failure' },
        order: { created_at: 'DESC', id: 'DESC' },
        take: 8,
      }),
      this.authSessionRepo.find({
        where: { status: 'active' },
        order: { last_seen_at: 'DESC', issued_at: 'DESC' },
        take: 8,
      }),
    ]);

    return {
      generated_at: now.toISOString(),
      controls: {
        jwt_expires_in: resolveJwtExpiresIn(),
        session_retention_days: resolveSessionRetentionDays(),
        access_log_retention_days: resolveAccessLogRetentionDays(),
        auth_audit_retention_days: resolveAuthAuditRetentionDays(),
        ip_capture_enabled: true,
        device_capture_enabled: true,
        session_revocation_enabled: true,
        access_logging_enabled: true,
      },
      auth_activity: {
        success_last_24h: Number(authRaw?.success_last_24h || 0),
        failure_last_24h: Number(authRaw?.failure_last_24h || 0),
        unique_ips_last_24h: Number(authRaw?.unique_ips_last_24h || 0),
      },
      session_activity: {
        active_sessions: Number(sessionRaw?.active_sessions || 0),
        revoked_last_7d: Number(sessionRaw?.revoked_last_7d || 0),
        expiring_soon: Number(sessionRaw?.expiring_soon || 0),
        stale_sessions: Number(sessionRaw?.stale_sessions || 0),
        ip_changed_sessions: Number(sessionRaw?.ip_changed_sessions || 0),
      },
      access_activity: {
        events_last_24h: Number(accessRaw?.events_last_24h || 0),
        denied_last_24h: Number(accessRaw?.denied_last_24h || 0),
        nexus_last_24h: Number(accessRaw?.nexus_last_24h || 0),
      },
      lockout_policy: {
        locked_accounts: Number(lockoutRaw?.locked_accounts || 0),
        min_lockout_limit: Number(lockoutRaw?.min_lockout_limit || 0),
        max_lockout_limit: Number(lockoutRaw?.max_lockout_limit || 0),
      },
      audit_activity: {
        warnings_last_7d: Number(auditRaw?.warnings_last_7d || 0),
        errors_last_7d: Number(auditRaw?.errors_last_7d || 0),
      },
      recent_failed_logins: recentFailedLogins.map((attempt) => ({
        id: attempt.id,
        user_id: attempt.user_id,
        user_type: attempt.user_type,
        ip_address: attempt.ip_address,
        user_agent: attempt.UserManagement_agent,
        tenant_slug: attempt.tenant_slug,
        failure_reason: attempt.failure_reason,
        request_id: attempt.request_id,
        created_at: attempt.created_at,
      })),
      active_sessions: activeSessions.map((session) => this.mapSession(session)),
    };
  }

  async listSessions(query: QuerySecuritySessionsDto = {}) {
    const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
    const offset = Math.max(query.offset ?? 0, 0);
    const qb = this.authSessionRepo.createQueryBuilder('session');

    if (query.search?.trim()) {
      const search = `%${query.search.trim()}%`;
      qb.andWhere(new Brackets((subQuery) => {
        subQuery
          .where('session.username LIKE :search', { search })
          .orWhere('session.user_id LIKE :search', { search })
          .orWhere('session.client_id LIKE :search', { search })
          .orWhere('session.ip_address LIKE :search', { search })
          .orWhere('session.last_seen_ip LIKE :search', { search })
          .orWhere('session.device_label LIKE :search', { search });
      }));
    }

    if (query.status) {
      qb.andWhere('session.status = :status', { status: query.status });
    }

    if (query.user_type) {
      qb.andWhere('session.user_type = :userType', { userType: query.user_type });
    }

    const [items, total] = await Promise.all([
      qb.clone()
        .orderBy('session.last_seen_at', 'DESC')
        .addOrderBy('session.issued_at', 'DESC')
        .take(limit)
        .skip(offset)
        .getMany(),
      qb.clone().getCount(),
    ]);

    return {
      items: items.map((session) => this.mapSession(session)),
      total,
      limit,
      offset,
      has_more: offset + items.length < total,
    };
  }

  async listAccessLogs(query: QueryAccessLogsDto = {}) {
    const limit = Math.min(Math.max(query.limit ?? 25, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);
    const qb = this.authAccessLogRepo.createQueryBuilder('access');

    if (query.search?.trim()) {
      const search = `%${query.search.trim()}%`;
      qb.andWhere(new Brackets((subQuery) => {
        subQuery
          .where('access.username LIKE :search', { search })
          .orWhere('access.user_id LIKE :search', { search })
          .orWhere('access.client_id LIKE :search', { search })
          .orWhere('access.request_path LIKE :search', { search })
          .orWhere('access.ip_address LIKE :search', { search });
      }));
    }

    if (query.portal) {
      qb.andWhere('access.portal = :portal', { portal: query.portal });
    }

    if (query.min_status_code) {
      qb.andWhere('access.status_code >= :minStatusCode', {
        minStatusCode: query.min_status_code,
      });
    }

    if (query.max_status_code) {
      qb.andWhere('access.status_code <= :maxStatusCode', {
        maxStatusCode: query.max_status_code,
      });
    }

    if (query.date_from) {
      qb.andWhere('access.created_at >= :dateFrom', { dateFrom: query.date_from });
    }

    if (query.date_to) {
      qb.andWhere('access.created_at <= :dateTo', { dateTo: query.date_to });
    }

    const [items, total] = await Promise.all([
      qb.clone()
        .orderBy('access.created_at', 'DESC')
        .addOrderBy('access.id', 'DESC')
        .take(limit)
        .skip(offset)
        .getMany(),
      qb.clone().getCount(),
    ]);

    return {
      items,
      total,
      limit,
      offset,
      has_more: offset + items.length < total,
    };
  }

  async revokeSession(sessionId: string, actor: JwtPayload, reason?: string) {
    const session = await this.authSessionRepo.findOne({
      where: { session_id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Security session not found');
    }

    await this.authSessionRepo.update(
      { session_id: sessionId },
      {
        status: 'revoked',
        revoked_at: new Date(),
        revoke_reason: reason?.trim() || 'Revoked from security console',
      },
    );

    await this.auditService.createLog({
      userId: String(actor.sub),
      UserManagementName: actor.username || 'System User',
      UserManagementRole: String(actor.role || 'Platform'),
      actorType: actor.is_system ? 'system' : actor.user_type || 'system',
      clientId: session.client_id,
      branchId: session.branch_id,
      entityId: session.session_id,
      requestMethod: 'POST',
      requestPath: `/v1/platform/security/sessions/${session.session_id}/revoke`,
      action: 'Revoke Session',
      entity: 'Security Session',
      portal: 'Nexus',
      ipAddress: session.last_seen_ip || session.ip_address || undefined,
      status: 'warning',
      details: `Session revoked for ${session.username || session.user_id}`,
      metadataJson: JSON.stringify({
        session_id: session.session_id,
        revoked_reason: reason?.trim() || 'Revoked from security console',
        session_user_id: session.user_id,
        session_client_id: session.client_id,
      }),
    });

    return {
      success: true,
      session_id: session.session_id,
      revoked_at: new Date().toISOString(),
    };
  }

  private mapSession(session: AuthSession) {
    const now = Date.now();
    const risk_flags: string[] = [];

    if (
      session.status === 'active' &&
      session.last_seen_ip &&
      session.ip_address &&
      session.last_seen_ip !== session.ip_address
    ) {
      risk_flags.push('ip_changed');
    }

    if (
      session.status === 'active' &&
      session.expires_at.getTime() <= now + 6 * 60 * 60 * 1000
    ) {
      risk_flags.push('expiring_soon');
    }

    if (
      session.status === 'active' &&
      (!session.last_seen_at ||
        session.last_seen_at.getTime() < now - 24 * 60 * 60 * 1000)
    ) {
      risk_flags.push('stale');
    }

    return {
      session_id: session.session_id,
      user_id: session.user_id,
      username: session.username,
      user_type: session.user_type,
      client_id: session.client_id,
      branch_id: session.branch_id,
      portal: session.portal,
      status: session.status,
      ip_address: session.ip_address,
      last_seen_ip: session.last_seen_ip,
      device_label: session.device_label,
      issued_at: session.issued_at,
      expires_at: session.expires_at,
      last_seen_at: session.last_seen_at,
      last_seen_path: session.last_seen_path,
      revoke_reason: session.revoke_reason,
      risk_flags,
    };
  }
}
