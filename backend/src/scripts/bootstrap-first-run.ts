import { NestFactory } from '@nestjs/core';
import '../config/env.config';
import { AppModule } from '../app.module';
import {
  BootstrapClientOptions,
  PlatformBootstrapService,
  type BootstrapStarterProfile,
} from '../platform/platform-bootstrap.service';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function readStarterProfile(): BootstrapStarterProfile {
  const profile = (readOptionalEnv('BOOTSTRAP_CLIENT_STARTER_PROFILE') || 'none').toLowerCase();
  if (profile === 'none' || profile === 'kitchen-club') {
    return profile;
  }

  throw new Error(
    `Invalid BOOTSTRAP_CLIENT_STARTER_PROFILE value "${profile}". Expected "none" or "kitchen-club".`,
  );
}

function resolveClientOptions(): BootstrapClientOptions | undefined {
  const clientKeys = [
    'BOOTSTRAP_CLIENT_NAME',
    'BOOTSTRAP_CLIENT_SLUG',
    'BOOTSTRAP_CLIENT_ADMIN_USERNAME',
    'BOOTSTRAP_CLIENT_ADMIN_EMAIL',
    'BOOTSTRAP_CLIENT_ADMIN_PASSWORD',
  ];
  const hasAnyClientValue = clientKeys.some((key) => Boolean(process.env[key]?.trim()));
  if (!hasAnyClientValue) {
    return undefined;
  }

  return {
    clientId: readOptionalEnv('BOOTSTRAP_CLIENT_ID') || 'CL-10001',
    clientCode: readOptionalEnv('BOOTSTRAP_CLIENT_CODE') || 'TEN-10001',
    clientName: requireEnv('BOOTSTRAP_CLIENT_NAME'),
    legalName: readOptionalEnv('BOOTSTRAP_CLIENT_LEGAL_NAME'),
    shortName: readOptionalEnv('BOOTSTRAP_CLIENT_SHORT_NAME'),
    domainSlug: requireEnv('BOOTSTRAP_CLIENT_SLUG'),
    businessType: readOptionalEnv('BOOTSTRAP_CLIENT_BUSINESS_TYPE') || 'restaurant',
    currency: readOptionalEnv('BOOTSTRAP_CLIENT_CURRENCY') || 'USD',
    language: readOptionalEnv('BOOTSTRAP_CLIENT_LANGUAGE') || 'en',
    timezone: readOptionalEnv('BOOTSTRAP_CLIENT_TIMEZONE') || 'UTC',
    planCode: readOptionalEnv('BOOTSTRAP_CLIENT_PLAN_CODE') || 'START-01',
    admin: {
      fullName:
        readOptionalEnv('BOOTSTRAP_CLIENT_ADMIN_FULL_NAME') || 'Client Administrator',
      username: requireEnv('BOOTSTRAP_CLIENT_ADMIN_USERNAME'),
      email: requireEnv('BOOTSTRAP_CLIENT_ADMIN_EMAIL'),
      password: requireEnv('BOOTSTRAP_CLIENT_ADMIN_PASSWORD'),
    },
    starterProfile: readStarterProfile(),
    starterUsers:
      readStarterProfile() === 'kitchen-club'
        ? {
            branchManagerPassword: requireEnv('BOOTSTRAP_CLIENT_BRANCH_MANAGER_PASSWORD'),
            cashierPassword: requireEnv('BOOTSTRAP_CLIENT_CASHIER_PASSWORD'),
          }
        : undefined,
  };
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const bootstrapService = app.get(PlatformBootstrapService);
    const result = await bootstrapService.run({
      superAdmin: {
        fullName:
          readOptionalEnv('BOOTSTRAP_SUPER_ADMIN_FULL_NAME') || 'KitchenOS Super Admin',
        username: requireEnv('BOOTSTRAP_SUPER_ADMIN_USERNAME'),
        email: requireEnv('BOOTSTRAP_SUPER_ADMIN_EMAIL'),
        password: requireEnv('BOOTSTRAP_SUPER_ADMIN_PASSWORD'),
      },
      client: resolveClientOptions(),
    });

    console.log('Bootstrap completed successfully.');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error('First-run bootstrap failed.');
  console.error(error);
  process.exit(1);
});
