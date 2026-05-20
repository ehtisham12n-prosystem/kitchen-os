import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  ArrayUnique,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { BranchAssignmentDto } from './assign-branches.dto';

const toOptionalInt = ({ value }: { value: unknown }) => {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  if (Number.isInteger(parsed)) {
    return parsed > 0 ? parsed : undefined;
  }

  return value;
};

export class CreateUserDto {
  @IsString()
  @MaxLength(150)
  full_name: string;

  @IsString()
  @MaxLength(150)
  user_name: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MaxLength(255)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  employee_id?: string;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  role_id?: number;



  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  department_id?: number;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  designation_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  management_pin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  pos_approval_pin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  pos_user_pin?: string;

  @IsOptional()
  @IsEnum(['PLATFORM_ADMIN', 'CLIENT_ADMIN', 'BRANCH_STAFF'])
  user_type?: 'PLATFORM_ADMIN' | 'CLIENT_ADMIN' | 'BRANCH_STAFF';

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  alternate_phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  emergency_contact_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  emergency_contact_relationship?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  emergency_contact_phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cnic_number?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  father_husband_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  religion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  sect?: string;

  @IsOptional()
  @IsDateString()
  date_of_birth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  locality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsDateString()
  joining_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  employment_type?: string;

  @IsOptional()
  @IsDateString()
  leaving_date?: string;

  @IsOptional()
  @IsNumberString()
  current_salary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  salary_type?: string;

  @IsOptional()
  @IsDateString()
  salary_revision_date?: string;

  @IsOptional()
  @IsString()
  hr_remarks?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  vehicle_type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  vehicle_reg_no?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  vehicle_make_model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  vehicle_color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bank_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  account_title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  account_number?: string;

  @IsOptional()
  @IsBoolean()
  force_password_change?: boolean;

  @IsOptional()
  @IsEnum(['active', 'inactive', 'suspended'])
  status?: 'active' | 'inactive' | 'suspended';

  @IsOptional()
  @IsString()
  profile_picture?: string;

  @IsOptional()
  @IsArray()
  attachments?: Array<{ id: string; title: string; file: string; fileName: string }>;

  @IsOptional()
  @ArrayUnique((assignment: BranchAssignmentDto) => assignment.branchId)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchAssignmentDto)
  branchAssignments?: BranchAssignmentDto[];
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  full_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  user_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  employee_id?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  password?: string;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  role_id?: number;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  department_id?: number;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  designation_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  management_pin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  pos_approval_pin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  pos_user_pin?: string;

  @IsOptional()
  @IsEnum(['PLATFORM_ADMIN', 'CLIENT_ADMIN', 'BRANCH_STAFF'])
  user_type?: 'PLATFORM_ADMIN' | 'CLIENT_ADMIN' | 'BRANCH_STAFF';

  @IsOptional()
  @IsEnum(['active', 'inactive', 'suspended'])
  status?: 'active' | 'inactive' | 'suspended';

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  alternate_phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  emergency_contact_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  emergency_contact_relationship?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  emergency_contact_phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cnic_number?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  father_husband_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  religion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  sect?: string;

  @IsOptional()
  @IsDateString()
  date_of_birth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  locality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsDateString()
  joining_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  employment_type?: string;

  @IsOptional()
  @IsDateString()
  leaving_date?: string;

  @IsOptional()
  @IsNumberString()
  current_salary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  salary_type?: string;

  @IsOptional()
  @IsDateString()
  salary_revision_date?: string;

  @IsOptional()
  @IsString()
  hr_remarks?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  vehicle_type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  vehicle_reg_no?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  vehicle_make_model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  vehicle_color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bank_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  account_title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  account_number?: string;

  @IsOptional()
  @IsString()
  profile_picture?: string;

  @IsOptional()
  @IsBoolean()
  force_password_change?: boolean;

  @IsOptional()
  @IsArray()
  attachments?: Array<{ id: string; title: string; file: string; fileName: string }>;

  @IsOptional()
  @ArrayUnique((assignment: BranchAssignmentDto) => assignment.branchId)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchAssignmentDto)
  branchAssignments?: BranchAssignmentDto[];
}

export class UpdateMyProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  full_name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  alternate_phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  emergency_contact_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  emergency_contact_relationship?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  emergency_contact_phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  locality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  profile_picture?: string;
}

export class UpdateMySecurityDto {
  @IsString()
  @MaxLength(255)
  current_password: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  new_password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  pos_approval_pin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  management_pin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  pos_user_pin?: string;
}
