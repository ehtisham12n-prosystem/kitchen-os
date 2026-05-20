import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Designation } from '../entities/Designation.entity';
import { UserManagement } from '../entities/UserManagement.entity';
import { CreateDesignationDto, UpdateDesignationDto } from './dto/Designation.dto';

@Injectable()
export class DesignationsService {
    constructor(
        @InjectRepository(Designation)
        private designationRepo: Repository<Designation>,
        @InjectRepository(UserManagement)
        private UserManagementRepo: Repository<UserManagement>,
    ) { }

    async create(clientId: string, dto: CreateDesignationDto): Promise<Designation> {
        const designation = this.designationRepo.create({
            ...dto,
            clientId,
        });
        return this.designationRepo.save(designation);
    }

    async findAll(clientId: string): Promise<Designation[]> {
        return this.designationRepo.find({
            where: { clientId },
            order: { name: 'ASC' }
        });
    }

    async findOne(clientId: string, id: number): Promise<Designation> {
        const designation = await this.designationRepo.findOne({
            where: { clientId, id },
        });
        if (!designation) throw new NotFoundException('Designation not found');
        return designation;
    }

    async update(clientId: string, id: number, dto: UpdateDesignationDto): Promise<Designation> {
        const designation = await this.findOne(clientId, id);
        Object.assign(designation, dto);
        return this.designationRepo.save(designation);
    }

    async remove(clientId: string, id: number): Promise<void> {
        const designation = await this.findOne(clientId, id);

        // Safety Check: Verify no staff members are assigned to this designation
        const staffCount = await this.UserManagementRepo.count({
            where: { designation_id: id, client_id: clientId }
        });
        if (staffCount > 0) {
            throw new BadRequestException('Cannot delete designation: There are staff members assigned to it.');
        }

        await this.designationRepo.remove(designation);
    }
}
