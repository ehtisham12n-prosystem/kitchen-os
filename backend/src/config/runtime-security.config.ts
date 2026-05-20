import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { getBooleanEnv, getNodeEnv, getOptionalEnv, getRequiredEnv } from './env.config';

const LOCAL_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:5190',
  'http://127.0.0.1:5190',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

const PLACEHOLDER_JWT_SECRETS = new Set([
  'change-this-before-production',
  'replace_with_a_long_random_secret',
  'changeme',
  'change_me',
  'secret',
  'jwt_secret',
  'your_jwt_secret',
  'test-jwt-secret',
]);

function parseCommaSeparatedList(value?: string): string[] {
  if (!value) {
    return [];
  }

  return [...new Set(
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )];
}

export function isProductionLikeEnv(nodeEnv = getNodeEnv()): boolean {
  const normalized = nodeEnv.trim().toLowerCase();
  return normalized === 'production' || normalized === 'staging';
}

export function getJwtSecret(): string {
  const secret = getRequiredEnv('JWT_SECRET', {
    testFallback: 'test-jwt-secret',
  });

  if (isProductionLikeEnv()) {
    if (secret.length < 32) {
      throw new Error(
        'JWT_SECRET must be at least 32 characters long in staging/production.',
      );
    }

    if (PLACEHOLDER_JWT_SECRETS.has(secret.trim().toLowerCase())) {
      throw new Error(
        'JWT_SECRET is using a placeholder value. Set a strong unique secret before staging/production startup.',
      );
    }
  }

  return secret;
}

export function getAllowedCorsOrigins(): string[] {
  const configuredOrigins = parseCommaSeparatedList(
    getOptionalEnv('CORS_ALLOWED_ORIGINS'),
  );

  if (configuredOrigins.length > 0) {
    return configuredOrigins;
  }

  if (isProductionLikeEnv()) {
    throw new Error(
      'CORS_ALLOWED_ORIGINS must be configured for staging/production startup.',
    );
  }

  return LOCAL_ALLOWED_ORIGINS;
}

export function buildCorsOptions(): CorsOptions {
  const allowedOrigins = getAllowedCorsOrigins();
  const allowCredentials = getBooleanEnv('CORS_ALLOW_CREDENTIALS', true);

  return {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin not allowed: ${origin}`), false);
    },
    credentials: allowCredentials,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Accept',
      'Origin',
      'X-Branch-Id',
      'X-Tenant-Slug',
      'X-Requested-With',
    ],
    exposedHeaders: ['Authorization'],
    optionsSuccessStatus: 204,
  };
}

export function assertRuntimeSecurityConfig(): void {
  getJwtSecret();
  getAllowedCorsOrigins();

  if (isProductionLikeEnv()) {
    const backupStoragePath = getOptionalEnv('BACKUP_STORAGE_PATH');
    const backupRetentionDays = getOptionalEnv('BACKUP_RETENTION_DAYS');

    if (!backupStoragePath || !backupRetentionDays) {
      throw new Error(
        'BACKUP_STORAGE_PATH and BACKUP_RETENTION_DAYS must be configured for staging/production startup.',
      );
    }
  }
}
