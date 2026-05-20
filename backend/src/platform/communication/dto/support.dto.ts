import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber } from 'class-validator';

export class CreateTicketDto {
    @IsNumber()
    @IsNotEmpty()
    client_id: string;

    @IsString()
    @IsNotEmpty()
    subject: string;

    @IsEnum(['low', 'medium', 'high', 'urgent'])
    @IsOptional()
    priority?: string;

    @IsString()
    @IsNotEmpty()
    initial_message: string;
}

export class CreateMessageDto {
    @IsString()
    @IsNotEmpty()
    text: string;

    @IsEnum(['client', 'support'])
    @IsOptional()
    sender?: string; // Optional if auto-determined by current UserManagement context
}

export class UpdateTicketStatusDto {
    @IsEnum(['open', 'in_progress', 'resolved'])
    status: string;
}
