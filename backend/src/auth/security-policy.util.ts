import { getNumberEnv, getOptionalEnv } from '../config/env.config';

export function resolveJwtExpiresIn(): string {
  return getOptionalEnv('JWT_EXPIRES_IN') ?? '12h';
}

export function resolveSessionRetentionDays(): number {
  return getNumberEnv('SECURITY_SESSION_RETENTION_DAYS', 90);
}

export function resolveAccessLogRetentionDays(): number {
  return getNumberEnv('SECURITY_ACCESS_LOG_RETENTION_DAYS', 180);
}

export function resolveAuthAuditRetentionDays(): number {
  return getNumberEnv('SECURITY_AUTH_AUDIT_RETENTION_DAYS', 365);
}

export function addDays(baseDate: Date, days: number): Date {
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

export function addDuration(baseDate: Date, rawDuration: string | number): Date {
  if (typeof rawDuration === 'number' && Number.isFinite(rawDuration)) {
    return new Date(baseDate.getTime() + rawDuration * 1000);
  }

  const duration = String(rawDuration).trim();
  const match = duration.match(/^(\d+)([smhd])$/i);
  if (!match) {
    return addDays(baseDate, 1);
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier =
    unit === 's'
      ? 1000
      : unit === 'm'
        ? 60 * 1000
        : unit === 'h'
          ? 60 * 60 * 1000
          : 24 * 60 * 60 * 1000;

  return new Date(baseDate.getTime() + amount * multiplier);
}
