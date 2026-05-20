import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import type { AttendanceStatus } from '../../entities/attendance-log.entity';

class AttendanceEntryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  user_id: number;

  @IsEnum(['present', 'absent', 'late', 'leave', 'off_duty'])
  status: AttendanceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  comments?: string;
}

export class MarkAttendanceDto {
  @IsDateString()
  date: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceEntryDto)
  entries: AttendanceEntryDto[];
}
