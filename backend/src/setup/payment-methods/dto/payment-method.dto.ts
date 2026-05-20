import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePaymentMethodDto {
  @IsString()
  @MaxLength(100)
  method_name: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  method_code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdatePaymentMethodDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  method_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  method_code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
