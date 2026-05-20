import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

const toNumber = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
};

export class QueryAccessLogsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(['Nexus', 'Console', 'Terminal', 'Public'])
  portal?: 'Nexus' | 'Console' | 'Terminal' | 'Public';

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(100)
  @Max(599)
  min_status_code?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(100)
  @Max(599)
  max_status_code?: number;

  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  date_to?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(0)
  offset?: number;
}
