import type { FindOptionsWhere } from 'typeorm';
import { Client } from './entities/client.entity';

export type ClientIdentifier = string | number;

export function normalizeClientIdentifier(id: ClientIdentifier): string {
  const normalized = String(id).trim().toUpperCase();
  if (/^CL-\d+$/.test(normalized)) {
    return normalized.replace('-', '');
  }
  return normalized;
}

export function buildClientLookupWhere(
  id: ClientIdentifier,
): FindOptionsWhere<Client>[] {
  const normalized = normalizeClientIdentifier(id);
  const numericId = Number(normalized);
  const conditions: FindOptionsWhere<Client>[] = [{ client_code: normalized }];
  if (normalized && Number.isInteger(numericId)) {
    conditions.unshift({ id: numericId });
  }
  return conditions;
}

export function getClientCode(client: Pick<Client, 'client_code'>): string {
  return client.client_code;
}
