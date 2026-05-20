import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateOnboardingStepDto {
  @IsEnum(['pending', 'completed', 'blocked', 'failed'])
  status: 'pending' | 'completed' | 'blocked' | 'failed';

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateInitialAdminDto {
  @IsString()
  @MaxLength(150)
  full_name: string;

  @IsString()
  @MaxLength(150)
  user_name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(255)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}
