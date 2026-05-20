import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderType } from './entities/order-type.entity';
import { CreateOrderTypeDto, UpdateOrderTypeDto } from './dto/order-type.dto';

@Injectable()
export class OrderTypeService {
    constructor(
        @InjectRepository(OrderType)
        private readonly orderTypeRepo: Repository<OrderType>,
    ) { }

    async create(clientId: string, dto: CreateOrderTypeDto): Promise<OrderType> {
        const orderType = this.orderTypeRepo.create({
            ...dto,
            client_id: clientId,
        });
        return this.orderTypeRepo.save(orderType);
    }

    async findAll(clientId: string): Promise<OrderType[]> {
        return this.orderTypeRepo.find({
            where: { client_id: clientId },
            order: { sort_order: 'ASC', name: 'ASC' },
        });
    }

    async findOne(clientId: string, id: number): Promise<OrderType> {
        const orderType = await this.orderTypeRepo.findOne({
            where: { client_id: clientId, id },
        });
        if (!orderType) throw new NotFoundException('Order Type not found');
        return orderType;
    }

    async update(clientId: string, id: number, dto: UpdateOrderTypeDto): Promise<OrderType> {
        const orderType = await this.findOne(clientId, id);
        Object.assign(orderType, dto);
        return this.orderTypeRepo.save(orderType);
    }

    async remove(clientId: string, id: number): Promise<void> {
        const orderType = await this.findOne(clientId, id);
        await this.orderTypeRepo.remove(orderType);
    }
}
