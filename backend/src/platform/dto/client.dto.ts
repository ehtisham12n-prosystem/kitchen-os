import { IsString, IsNotEmpty, IsOptional, IsEmail, IsUrl, IsEnum, IsNumber, IsArray, IsBoolean } from 'class-validator';

export class CreateClientDto {
    @IsString()
    @IsNotEmpty()
    client_name: string;

    @IsString()
    @IsOptional()
    short_name?: string;

    @IsString()
    @IsNotEmpty()
    domain_slug: string;

    @IsString()
    @IsOptional()
    business_type?: string;

    @IsString()
    @IsOptional()
    address?: string;

    @IsString()
    @IsOptional()
    area?: string;

    @IsString()
    @IsOptional()
    city?: string;

    @IsString()
    @IsOptional()
    country?: string;

    @IsString()
    @IsOptional()
    phone?: string;

    @IsEmail()
    @IsOptional()
    email?: string;

    @IsString()
    @IsOptional()
    cell_phone?: string;

    @IsUrl()
    @IsOptional()
    website_url?: string;

    @IsString()
    @IsOptional()
    currency?: string;

    @IsString()
    @IsOptional()
    language?: string;

    @IsString()
    @IsOptional()
    timezone?: string;

    @IsString()
    @IsOptional()
    poc_full_name?: string;

    @IsString()
    @IsOptional()
    poc_designation?: string;

    @IsString()
    @IsOptional()
    poc_phone?: string;

    @IsString()
    @IsOptional()
    poc_cell_phone?: string;

    @IsEmail()
    @IsOptional()
    poc_email?: string;

    @IsString()
    @IsOptional()
    comments?: string;

    @IsEnum(['active', 'suspended', 'expired_grace', 'read_only'])
    @IsOptional()
    status?: string;

    @IsNumber()
    @IsOptional()
    theme_id?: number;

    @IsNumber()
    @IsOptional()
    max_branches?: number;

    @IsNumber()
    @IsOptional()
    max_users?: number;

    @IsNumber()
    @IsOptional()
    subscription_plan_id?: number;

    @IsEnum(['monthly', 'annual'])
    @IsOptional()
    subscription_type?: string;

    @IsString()
    @IsOptional()
    subscription_start?: string;

    @IsString()
    @IsOptional()
    subscription_end?: string;

    @IsNumber()
    @IsOptional()
    renewal_day?: number;

    @IsString()
    @IsOptional()
    renewal_date?: string;

    @IsNumber()
    @IsOptional()
    grace_period_days?: number;

    @IsArray()
    @IsOptional()
    enabled_modules?: string[];

    @IsString()
    @IsOptional()
    onboarding_blueprint?: string;

    // Admin Account
    @IsString()
    @IsOptional()
    initialBranchName?: string;

    @IsString()
    @IsOptional()
    admin_name?: string;

    @IsString()
    @IsNotEmpty()
    admin_username: string;

    @IsString()
    @IsNotEmpty()
    admin_password: string;

    @IsBoolean()
    @IsOptional()
    admin_force_password_change?: boolean;
}

export class UpdateClientDto {
    @IsString()
    @IsOptional()
    client_name?: string;

    @IsString()
    @IsOptional()
    short_name?: string;

    @IsString()
    @IsOptional()
    business_type?: string;

    @IsString()
    @IsOptional()
    address?: string;

    @IsString()
    @IsOptional()
    area?: string;

    @IsString()
    @IsOptional()
    city?: string;

    @IsString()
    @IsOptional()
    country?: string;

    @IsString()
    @IsOptional()
    phone?: string;

    @IsEmail()
    @IsOptional()
    email?: string;

    @IsString()
    @IsOptional()
    cell_phone?: string;

    @IsUrl()
    @IsOptional()
    website_url?: string;

    @IsString()
    @IsOptional()
    currency?: string;

    @IsString()
    @IsOptional()
    language?: string;

    @IsString()
    @IsOptional()
    timezone?: string;

    @IsString()
    @IsOptional()
    poc_full_name?: string;

    @IsString()
    @IsOptional()
    poc_designation?: string;

    @IsString()
    @IsOptional()
    poc_phone?: string;

    @IsString()
    @IsOptional()
    poc_cell_phone?: string;

    @IsEmail()
    @IsOptional()
    poc_email?: string;

    @IsString()
    @IsOptional()
    comments?: string;

    @IsEnum(['active', 'suspended', 'expired_grace', 'read_only'])
    @IsOptional()
    status?: string;

    @IsNumber()
    @IsOptional()
    theme_id?: number;

    @IsNumber()
    @IsOptional()
    max_branches?: number;

    @IsNumber()
    @IsOptional()
    max_users?: number;

    @IsNumber()
    @IsOptional()
    subscription_plan_id?: number;

    @IsEnum(['monthly', 'annual'])
    @IsOptional()
    subscription_type?: string;

    @IsString()
    @IsOptional()
    subscription_start?: string;

    @IsString()
    @IsOptional()
    subscription_end?: string;

    @IsNumber()
    @IsOptional()
    renewal_day?: number;

    @IsString()
    @IsOptional()
    renewal_date?: string;

    @IsNumber()
    @IsOptional()
    grace_period_days?: number;

    @IsArray()
    @IsOptional()
    enabled_modules?: string[];

    @IsString()
    @IsOptional()
    onboarding_blueprint?: string;
}
