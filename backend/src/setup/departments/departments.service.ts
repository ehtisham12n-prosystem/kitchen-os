import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Departments } from '../entities/Departments.entity';
import { UserManagement } from '../entities/UserManagement.entity';
import { CreateDepartmentsDto, UpdateDepartmentsDto } from './dto/Departments.dto';

@Injectable()
export class DepartmentsService {
    constructor(
        @InjectRepository(Departments)
        private DepartmentsRepo: Repository<Departments>,
        @InjectRepository(UserManagement)
        private UserManagementRepo: Repository<UserManagement>,
    ) { }

    async create(clientId: string, dto: CreateDepartmentsDto): Promise<Departments> {
        const department = this.DepartmentsRepo.create({
            ...dto,
            clientId,
        });
        return this.DepartmentsRepo.save(department);
    }

    async findAll(clientId: string): Promise<Departments[]> {
        return this.DepartmentsRepo.find({
            where: { clientId },
            order: { name: 'ASC' }
        });
    }

    async findOne(clientId: string, id: number): Promise<Departments> {
        const department = await this.DepartmentsRepo.findOne({
            where: { clientId, id },
        });
        if (!department) throw new NotFoundException('Department not found');
        return department;
    }

    async update(clientId: string, id: number, dto: UpdateDepartmentsDto): Promise<Departments> {
        const department = await this.findOne(clientId, id);
        Object.assign(department, dto);
        return this.DepartmentsRepo.save(department);
    }

    async remove(clientId: string, id: number): Promise<void> {
        const department = await this.findOne(clientId, id);

        // Safety Check: Verify no staff members are assigned to this department
        const staffCount = await this.UserManagementRepo.count({
            where: { department_id: id, client_id: clientId }
        });
        if (staffCount > 0) {
            throw new BadRequestException('Cannot delete Departments: There are staff members assigned to it.');
        }

        await this.DepartmentsRepo.remove(department);
    }
}
