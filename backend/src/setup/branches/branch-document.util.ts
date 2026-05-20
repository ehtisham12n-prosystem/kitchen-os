import type { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import {
  extractDocumentSequence,
  formatBranchDocumentNumber,
  getDocumentWindowBounds,
  type BranchDocumentRule,
} from './branch-config.types';

type NextBranchDocumentNumberOptions<T extends ObjectLiteral> = {
  repository: Repository<T>;
  alias: string;
  clientId: string;
  branchId: number;
  branchCode: string;
  rule: BranchDocumentRule;
  counterCode?: string | null;
  documentColumn: string;
  clientColumn?: string;
  branchColumn?: string;
  createdAtColumn?: string;
  date?: Date;
  applyScope?: (query: SelectQueryBuilder<T>) => void;
};

export async function nextBranchDocumentNumber<T extends ObjectLiteral>(
  options: NextBranchDocumentNumberOptions<T>,
): Promise<string> {
  const {
    repository,
    alias,
    clientId,
    branchId,
    branchCode,
    rule,
    counterCode,
    documentColumn,
    clientColumn = 'client_id',
    branchColumn = 'branch_id',
    createdAtColumn = 'created_at',
    date = new Date(),
    applyScope,
  } = options;

  const query = repository.createQueryBuilder(alias)
    .select(`${alias}.${documentColumn}`, 'document_no')
    .where(`${alias}.${clientColumn} = :clientId`, { clientId })
    .andWhere(`${alias}.${branchColumn} = :branchId`, { branchId });

  const window = getDocumentWindowBounds(rule.reset_frequency, date, rule.manual_reset_at ?? null);
  if (window) {
    query
      .andWhere(`${alias}.${createdAtColumn} >= :windowStart`, { windowStart: window.start })
      .andWhere(`${alias}.${createdAtColumn} < :windowEnd`, { windowEnd: window.end });
  }

  applyScope?.(query);

  const latest = await query
    .orderBy(`${alias}.${createdAtColumn}`, 'DESC')
    .addOrderBy(`${alias}.${documentColumn}`, 'DESC')
    .limit(1)
    .getRawOne<{ document_no?: string | null }>();

  const nextSequence = extractDocumentSequence(latest?.document_no) + 1;
  return formatBranchDocumentNumber(rule, branchCode, nextSequence, date, counterCode);
}
