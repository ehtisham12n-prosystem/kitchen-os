import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupportTicket, TicketMessage } from '../../entities/support-ticket.entity';
import { CreateTicketDto, CreateMessageDto, UpdateTicketStatusDto } from '../dto/support.dto';

@Injectable()
export class SupportService {
    constructor(
        @InjectRepository(SupportTicket)
        private ticketRepo: Repository<SupportTicket>,
        @InjectRepository(TicketMessage)
        private messageRepo: Repository<TicketMessage>,
    ) { }

    async findAll() {
        return this.ticketRepo.find({
            relations: ['client', 'messages'],
            order: { created_at: 'DESC' }
        });
    }

    async findOne(id: string) {
        const t = await this.ticketRepo.findOne({
            where: { id },
            relations: ['client', 'messages']
        });
        if (!t) throw new NotFoundException('Ticket not found');
        return t;
    }

    async create(dto: CreateTicketDto, userId: string, UserManagementName: string) {
        const ticketCount = await this.ticketRepo.count();
        const ticketNumber = `TKT-${8040 + ticketCount + 1}`;

        const ticket = this.ticketRepo.create({
            ticket_number: ticketNumber,
            client_id: dto.client_id,
            subject: dto.subject,
            priority: dto.priority || 'medium',
            status: 'open',
            created_by: userId,
        });
        const savedTicket = await this.ticketRepo.save(ticket);

        const message = this.messageRepo.create({
            ticket_id: savedTicket.id,
            text: dto.initial_message,
            sender: 'client',
            author_id: userId,
            author_name: UserManagementName,
        });
        await this.messageRepo.save(message);

        return this.findOne(savedTicket.id);
    }

    async addMessage(ticketId: string, dto: CreateMessageDto, userId: string, UserManagementName: string, isSupport: boolean) {
        const t = await this.findOne(ticketId);
        if (t.status === 'resolved') {
            t.status = 'in_progress';
            await this.ticketRepo.save(t);
        }

        const message = this.messageRepo.create({
            ticket_id: ticketId,
            text: dto.text,
            sender: isSupport ? 'support' : 'client',
            author_id: userId,
            author_name: UserManagementName,
        });
        await this.messageRepo.save(message);

        if (isSupport && t.status === 'open') {
            t.status = 'in_progress';
            await this.ticketRepo.save(t);
        }

        return this.findOne(ticketId);
    }

    async updateStatus(id: string, dto: UpdateTicketStatusDto) {
        const t = await this.findOne(id);
        t.status = dto.status;
        if (dto.status === 'resolved') {
            t.resolved_at = new Date();
        }
        return this.ticketRepo.save(t);
    }

    async seed() {
        const count = await this.ticketRepo.count();
        if (count > 0) return;

        // Mock tickets would need valid client_id. Since we might not have many clients, we skip for now unless needed.
        // We'll leave it empty to be populated by the frontend during testing.
    }
}
