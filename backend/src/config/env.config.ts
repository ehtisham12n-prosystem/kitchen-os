import { existsSync, readFileSync } from 'fs';
import * as path from 'path';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const ENV_FILE_CANDIDATES = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '..', '.env'),
];

let envLoaded = false;

function stripWrappingQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function loadEnvFile(filePath: string) {
  const contents = readFileSync(filePath, 'utf8');
  const lines = contents.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    process.env[key] = stripWrappingQuotes(rawValue);
  }
}

export function ensureEnvLoaded() {
  if (envLoaded) {
    return;
  }

  for (const candidate of ENV_FILE_CANDIDATES) {
    if (existsSync(candidate)) {
      loadEnvFile(candidate);
    }
  }

  envLoaded = true;
}

function readTrimmedEnv(name: string, aliases: string[] = []): string | undefined {
  ensureEnvLoaded();

  for (const key of [name, ...aliases]) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

export function getNodeEnv(): string {
  return readTrimmedEnv('NODE_ENV') ?? 'development';
}

export function getRequiredEnv(
  name: string,
  options?: {
    aliases?: string[];
    testFallback?: string;
  },
): string {
  const value = readTrimmedEnv(name, options?.aliases);
  if (value) {
    return value;
  }

  if (options?.testFallback && getNodeEnv() === 'test') {
    return options.testFallback;
  }

  const aliasSuffix = options?.aliases?.length
    ? ` (aliases accepted: ${options.aliases.join(', ')})`
    : '';
  throw new Error(`Missing required environment variable: ${name}${aliasSuffix}`);
}

export function getOptionalEnv(name: string, aliases: string[] = []): string | undefined {
  return readTrimmedEnv(name, aliases);
}

export function getNumberEnv(name: string, fallback: number): number {
  const value = readTrimmedEnv(name);
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function getBooleanEnv(name: string, fallback = false): boolean {
  const value = readTrimmedEnv(name);
  if (!value) {
    return fallback;
  }

  return TRUE_VALUES.has(value.toLowerCase());
}

ensureEnvLoaded();
