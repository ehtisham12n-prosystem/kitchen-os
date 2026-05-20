import { getNumberEnv, getOptionalEnv, getRequiredEnv } from './env.config';

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export function getDatabaseConfig(): DatabaseConfig {
  const rawDatabase = getOptionalEnv('DB_DATABASE') ?? 'kitchenos';
  // Force away from legacy smoke DB to keep local runtime on primary data.
  const database = rawDatabase === 'kitchenos_release_smoke'
    ? 'kitchenos'
    : rawDatabase;

  return {
    host: getOptionalEnv('DB_HOST') ?? '127.0.0.1',
    port: getNumberEnv('DB_PORT', 3306),
    username: getRequiredEnv('DB_USERNAME', {
      aliases: ['DB_USER', 'DB_UserManagementNAME'],
      testFallback: 'test',
    }),
    password: getRequiredEnv('DB_PASSWORD', {
      testFallback: 'test',
    }),
    database,
  };
}
