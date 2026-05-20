import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Announcement } from '../../entities/announcement.entity';
import { CreateAnnouncementDto, UpdateAnnouncementStatusDto } from '../dto/announcement.dto';

@Injectable()
export class AnnouncementsService {
    constructor(
        @InjectRepository(Announcement)
        private repo: Repository<Announcement>,
    ) { }

    async findAll() {
        return this.repo.find({ order: { created_at: 'DESC' } });
    }

    async findActive() {
        const now = new Date();
        return this.repo.createQueryBuilder('a')
            .where('a.status = :active', { active: 'active' })
            .andWhere('(a.expires_at IS NULL OR a.expires_at > :now)', { now })
            .orderBy('a.created_at', 'DESC')
            .getMany();
    }

    async create(dto: CreateAnnouncementDto, sysuserId: string) {
        const announcement = this.repo.create({
            ...dto,
            expires_at: dto.expires_at ? new Date(dto.expires_at) : undefined,
            created_by: sysuserId,
        });
        return this.repo.save(announcement);
    }

    async updateStatus(id: string, dto: UpdateAnnouncementStatusDto) {
        const a = await this.repo.findOne({ where: { id } });
        if (!a) throw new NotFoundException('Announcement not found');
        a.status = dto.status;
        return this.repo.save(a);
    }

    async incrementViews(id: string) {
        await this.repo.increment({ id }, 'views', 1);
    }

    async remove(id: string) {
        const a = await this.repo.findOne({ where: { id } });
        if (!a) throw new NotFoundException();
        return this.repo.remove(a);
    }

    async seed() {
        const count = await this.repo.count();
        if (count > 0) return;

        const MOCKS = [
            {
                title: 'System Upgrade v2.5 Scheduled',
                message: 'KitchenOS scheduled maintenance: Sunday, March 2nd from 02:00 to 04:00 PKT.',
                type: 'warning',
                target: 'all',
                status: 'active',
                expires_at: new Date('2026-03-02T05:00:00Z'),
                views: 1245
            },
            {
                title: 'AI Sales Forecaster is live!',
                message: 'AI engine now available for Enterprise plan subscribers. Check your analytics dashboard.',
                type: 'success',
                target: 'enterprise_only',
                status: 'active',
                expires_at: new Date('2026-03-10T23:59:59Z'),
                views: 890
            }
        ];

        for (const m of MOCKS) {
            await this.repo.save(this.repo.create(m));
        }
    }
}
