import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Floor } from '../entities/floor.entity';
import { KitchenTableEntity } from '../entities/table.entity';
import { Branch } from '../entities/branch.entity';
import {
    CreateFloorDto,
    CreateTableDto,
    UpdateFloorDto,
    UpdateTableDto,
} from '../branches/dto/branch.dto';

@Injectable()
export class DiningLayoutService {
    constructor(
        @InjectRepository(Floor) private floorRepo: Repository<Floor>,
        @InjectRepository(KitchenTableEntity)
        private tableRepo: Repository<KitchenTableEntity>,
        @InjectRepository(Branch)
        private branchRepo: Repository<Branch>,
    ) { }

    private async assertBranchBelongsToClient(clientId: string, branchId: number): Promise<Branch> {
        const branch = await this.branchRepo.findOne({
            where: { id: branchId, client_id: clientId },
        });
        if (!branch) {
            throw new NotFoundException('Branch not found');
        }
        return branch;
    }

    private async assertFloorBelongsToClient(clientId: string, floorId: number): Promise<Floor> {
        const floor = await this.floorRepo.findOne({
            where: { id: floorId },
            relations: ['branch'],
        });
        if (!floor || floor.branch?.client_id !== clientId) {
            throw new NotFoundException('Floor not found');
        }
        return floor;
    }

    private assertBranchAccessible(branchId: number, accessibleBranchIds?: number[]): void {
        if (
            accessibleBranchIds &&
            accessibleBranchIds.length > 0 &&
            !accessibleBranchIds.includes(branchId)
        ) {
            throw new NotFoundException('Branch not found');
        }
    }

    private serializeFloor<T extends Floor>(floor: T) {
        return {
            ...floor,
            name: floor.floor_name,
            code: floor.floor_code,
            status: floor.is_active ? 'Active' : 'Inactive',
            last_updated: floor.updated_at,
        };
    }

    private serializeTable<T extends KitchenTableEntity>(table: T) {
        return {
            ...table,
            table_no: table.table_number,
            table_name: table.table_name || table.table_number,
            seating_capacity: table.capacity,
            current_status:
                table.status === 'vacant'
                    ? 'Available'
                    : table.status === 'occupied'
                        ? 'Occupied'
                        : table.status === 'reserved'
                            ? 'Reserved'
                            : 'Blocked',
        };
    }

    // ---- FLOOR METHODS ----

    async createFloor(clientId: string, branchId: number, dto: CreateFloorDto): Promise<Floor> {
        await this.assertBranchBelongsToClient(clientId, branchId);
        const floorName = dto.floor_name ?? dto.name;
        if (!floorName) {
            throw new BadRequestException('floor_name is required');
        }
        const floor = this.floorRepo.create({
            branch_id: branchId,
            floor_name: floorName,
            is_active: dto.is_active,
            floor_code: dto.code,
            description: dto.description,
            display_order: dto.display_order ?? 0,
        });
        const savedFloor = await this.floorRepo.save(floor);
        return this.serializeFloor(savedFloor) as any;
    }

    async updateFloor(
        clientId: string,
        floorId: number,
        dto: UpdateFloorDto,
        accessibleBranchIds?: number[],
    ): Promise<Floor> {
        const floor = await this.assertFloorBelongsToClient(clientId, floorId);
        this.assertBranchAccessible(floor.branch_id, accessibleBranchIds);
        const floorName = dto.floor_name ?? dto.name;
        if (floorName !== undefined) {
            floor.floor_name = floorName;
        }
        if (dto.is_active !== undefined) {
            floor.is_active = dto.is_active;
        }
        if (dto.code !== undefined) {
            floor.floor_code = dto.code;
        }
        if (dto.description !== undefined) {
            floor.description = dto.description;
        }
        if (dto.display_order !== undefined) {
            floor.display_order = dto.display_order;
        }
        const updated = await this.floorRepo.save(floor);
        return this.serializeFloor(updated) as any;
    }

    async removeFloor(
        clientId: string,
        floorId: number,
        accessibleBranchIds?: number[],
    ): Promise<void> {
        const floor = await this.assertFloorBelongsToClient(clientId, floorId);
        this.assertBranchAccessible(floor.branch_id, accessibleBranchIds);
        await this.floorRepo.remove(floor);
    }

    async findAllFloors(branchId: number): Promise<Floor[]> {
        const floors = await this.floorRepo.find({
            where: { branch_id: branchId },
            order: { display_order: 'ASC', floor_name: 'ASC' },
        });
        return floors.map((floor) => this.serializeFloor(floor)) as any;
    }

    // ---- TABLE METHODS ----

    async createTable(
        clientId: string,
        floorId: number,
        dto: CreateTableDto,
        accessibleBranchIds?: number[],
    ): Promise<KitchenTableEntity> {
        const floor = await this.assertFloorBelongsToClient(clientId, floorId);
        this.assertBranchAccessible(floor.branch_id, accessibleBranchIds);
        const table = this.tableRepo.create({
            floor_id: floorId,
            branch_id: floor.branch_id,
            table_number: dto.table_number,
            table_name: dto.table_name,
            capacity: dto.capacity,
            status: dto.status,
            is_active: dto.is_active,
        });
        const saved = await this.tableRepo.save(table);
        return this.serializeTable(saved) as any;
    }

    async updateTable(
        clientId: string,
        tableId: number,
        dto: UpdateTableDto,
        accessibleBranchIds?: number[],
    ): Promise<KitchenTableEntity> {
        const table = await this.tableRepo.findOne({
            where: { id: tableId },
            relations: ['branch'],
        });
        if (!table || table.branch?.client_id !== clientId) {
            throw new NotFoundException('Table not found');
        }
        this.assertBranchAccessible(table.branch_id, accessibleBranchIds);

        if (dto.floor_id !== undefined) {
            const floor = await this.assertFloorBelongsToClient(clientId, dto.floor_id);
            this.assertBranchAccessible(floor.branch_id, accessibleBranchIds);
            table.floor_id = floor.id;
            table.branch_id = floor.branch_id;
        }
        if (dto.table_number !== undefined) {
            table.table_number = dto.table_number;
        }
        if (dto.table_name !== undefined) {
            table.table_name = dto.table_name;
        }
        if (dto.capacity !== undefined) {
            table.capacity = dto.capacity;
        }
        if (dto.status !== undefined) {
            table.status = dto.status;
        }
        if (dto.is_active !== undefined) {
            table.is_active = dto.is_active;
        }

        const updated = await this.tableRepo.save(table);
        return this.serializeTable(updated) as any;
    }

    async removeTable(
        clientId: string,
        tableId: number,
        accessibleBranchIds?: number[],
    ): Promise<void> {
        const table = await this.tableRepo.findOne({
            where: { id: tableId },
            relations: ['branch'],
        });
        if (!table || table.branch?.client_id !== clientId) {
            throw new NotFoundException('Table not found');
        }
        this.assertBranchAccessible(table.branch_id, accessibleBranchIds);
        await this.tableRepo.remove(table);
    }

    async findAllTables(floorId: number): Promise<KitchenTableEntity[]> {
        const tables = await this.tableRepo.find({
            where: { floor_id: floorId },
            order: { table_number: 'ASC' },
        });
        return tables.map((table) => this.serializeTable(table)) as any;
    }

    async updateTableStatus(
        clientId: string,
        tableId: number,
        status: string,
        accessibleBranchIds?: number[],
    ): Promise<KitchenTableEntity> {
        const table = await this.tableRepo.findOne({
            where: { id: tableId },
            relations: ['branch'],
        });
        if (!table || table.branch?.client_id !== clientId) {
            throw new NotFoundException('Table not found');
        }
        this.assertBranchAccessible(table.branch_id, accessibleBranchIds);

        table.status = status;
        const updated = await this.tableRepo.save(table);
        if (!updated) throw new NotFoundException('Table not found');
        return this.serializeTable(updated) as any;
    }

    /**
     * Complex query to get the entire layout for a branch
     */
    async getFullBranchLayout(clientId: string, branchId: number) {
        await this.assertBranchBelongsToClient(clientId, branchId);
        const floors = await this.floorRepo.find({
            where: { branch_id: branchId },
            relations: ['tables'],
            order: { display_order: 'ASC', floor_name: 'ASC' },
        });
        return floors.map((floor) => ({
            ...this.serializeFloor(floor),
            tables: (floor.tables ?? []).map((table) => this.serializeTable(table)),
        }));
    }
}
