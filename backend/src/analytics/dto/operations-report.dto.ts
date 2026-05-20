import { Transform } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';

function normalizeIds(value: unknown): number[] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const rawValues = Array.isArray(value)
    ? value
    : String(value)
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);

  const ids = rawValues
    .map((entry) => Number(entry))
    .filter((entry) => Number.isInteger(entry) && entry > 0);

  return ids.length > 0 ? Array.from(new Set(ids)) : undefined;
}

export class OperationsReportQueryDto {
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeIds(value))
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  branch_ids?: number[];

  @IsOptional()
  @Transform(({ value }) => normalizeIds(value))
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  sales_category_ids?: number[];

  @IsOptional()
  @Transform(({ value }) => normalizeIds(value))
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  inventory_class_ids?: number[];
}
