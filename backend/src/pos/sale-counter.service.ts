import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SaleCounter } from './entities/sale-counter.entity';
import { CreateSaleCounterDto } from './dto/create-sale-counter.dto';
import { UpdateSaleCounterDto } from './dto/update-sale-counter.dto';
import { Branch } from '../setup/entities/branch.entity';

@Injectable()
export class SaleCounterService {
    constructor(
        @InjectRepository(SaleCounter)
        private readonly saleCounterRepo: Repository<SaleCounter>,
        @InjectRepository(Branch)
        private readonly branchRepo: Repository<Branch>,
    ) {}

    private async assertBranchBelongsToClient(clientId: string, branchId: number): Promise<void> {
        const branch = await this.branchRepo.findOne({ where: { id: branchId, client_id: clientId } });
        if (!branch) {
            throw new NotFoundException(`Branch ${branchId} not found`);
        }
    }

    private async ensureCodeAvailable(
        clientId: string,
        branchId: number,
        code: string,
        excludeId?: number,
    ): Promise<void> {
        const normalizedCode = code.trim().toUpperCase();
        const existing = await this.saleCounterRepo.findOne({
            where: { client_id: clientId, branch_id: branchId, code: normalizedCode },
        });

        if (existing && existing.id !== excludeId) {
            throw new BadRequestException(
                `Sale counter code "${normalizedCode}" already exists for this branch.`,
            );
        }
    }

    async create(createDto: CreateSaleCounterDto, clientId: string): Promise<SaleCounter> {
        await this.assertBranchBelongsToClient(clientId, createDto.branch_id);
        await this.ensureCodeAvailable(clientId, createDto.branch_id, createDto.code);
        const counter = this.saleCounterRepo.create({
            ...createDto,
            code: createDto.code.trim().toUpperCase(),
            client_id: clientId,
        });
        return this.saleCounterRepo.save(counter);
    }

    async findAll(
        clientId: string,
        branchId?: number,
        accessibleBranchIds?: number[],
    ): Promise<SaleCounter[]> {
        const query: any = { client_id: clientId };
        if (branchId) {
            await this.assertBranchBelongsToClient(clientId, branchId);
            query.branch_id = branchId;
        } else if (accessibleBranchIds && accessibleBranchIds.length > 0) {
            query.branch_id = In(accessibleBranchIds);
        }
        return this.saleCounterRepo.find({
            where: query,
        });
    }

    async findOne(
        id: number,
        clientId: string,
        accessibleBranchIds?: number[],
    ): Promise<SaleCounter> {
        const counter = await this.saleCounterRepo.findOne({
            where: { id, client_id: clientId },
        });
        if (
            !counter ||
            (accessibleBranchIds &&
                accessibleBranchIds.length > 0 &&
                !accessibleBranchIds.includes(counter.branch_id))
        ) {
            throw new NotFoundException(`Sale counter with ID ${id} not found`);
        }
        return counter;
    }

    async update(
        id: number,
        updateDto: UpdateSaleCounterDto,
        clientId: string,
        accessibleBranchIds?: number[],
    ): Promise<SaleCounter> {
        const counter = await this.findOne(id, clientId, accessibleBranchIds);
        if (updateDto.branch_id) {
            await this.assertBranchBelongsToClient(clientId, updateDto.branch_id);
            if (
                accessibleBranchIds &&
                accessibleBranchIds.length > 0 &&
                !accessibleBranchIds.includes(updateDto.branch_id)
            ) {
                throw new NotFoundException(`Sale counter with ID ${id} not found`);
            }
        }
        const nextBranchId = updateDto.branch_id ?? counter.branch_id;
        if (updateDto.code !== undefined) {
            await this.ensureCodeAvailable(clientId, nextBranchId, updateDto.code, counter.id);
        }
        Object.assign(counter, {
            ...updateDto,
            code: updateDto.code !== undefined ? updateDto.code.trim().toUpperCase() : counter.code,
        });
        return this.saleCounterRepo.save(counter);
    }

    async remove(id: number, clientId: string, accessibleBranchIds?: number[]): Promise<void> {
        const counter = await this.findOne(id, clientId, accessibleBranchIds);
        await this.saleCounterRepo.remove(counter);
    }
}
