import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Announcement } from '../entities/announcement.entity';
import { SupportTicket, TicketMessage } from '../entities/support-ticket.entity';
import { AnnouncementsService } from './announcements/announcements.service';
import { AnnouncementsController } from './announcements/announcements.controller';
import { SupportService } from './support/support.service';
import { SupportController } from './support/support.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([Announcement, SupportTicket, TicketMessage]),
    ],
    providers: [AnnouncementsService, SupportService],
    controllers: [AnnouncementsController, SupportController],
    exports: [AnnouncementsService, SupportService],
})
export class CommunicationModule { }
