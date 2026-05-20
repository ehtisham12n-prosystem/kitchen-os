import { IsString, IsNotEmpty, IsEnum, IsOptional, IsDateString } from 'class-validator';

export class CreateAnnouncementDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsNotEmpty()
    message: string;

    @IsEnum(['info', 'warning', 'danger', 'success'])
    @IsOptional()
    type?: string;

    @IsEnum(['all', 'enterprise_only', 'staff_only'])
    @IsOptional()
    target?: string;

    @IsDateString()
    @IsOptional()
    expires_at?: string;
}

export class UpdateAnnouncementStatusDto {
    @IsEnum(['draft', 'active', 'scheduled', 'expired'])
    status: string;
}
