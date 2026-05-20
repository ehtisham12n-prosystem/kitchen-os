import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentMethod } from '../entities/payment-method.entity';
import { CreatePaymentMethodDto, UpdatePaymentMethodDto } from './dto/payment-method.dto';

@Injectable()
export class PaymentMethodsService {
  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepo: Repository<PaymentMethod>,
  ) {}

  private normalizeCode(code: string): string {
    return code
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private deriveCode(name: string): string {
    return this.normalizeCode(name);
  }

  private async ensureUniqueCode(clientId: string, methodCode: string, excludeId?: number): Promise<void> {
    const existing = await this.paymentMethodRepo.findOne({
      where: { client_id: clientId, method_code: methodCode },
    });

    if (existing && existing.id !== excludeId) {
      throw new BadRequestException(`Payment method code ${methodCode} already exists.`);
    }
  }

  async create(clientId: string, dto: CreatePaymentMethodDto): Promise<PaymentMethod> {
    const methodCode = this.normalizeCode(dto.method_code || this.deriveCode(dto.method_name));
    await this.ensureUniqueCode(clientId, methodCode);

    const entity = this.paymentMethodRepo.create({
      client_id: clientId,
      method_name: dto.method_name.trim(),
      method_code: methodCode,
      description: dto.description?.trim() || null,
      is_active: dto.is_active ?? true,
    });

    return this.paymentMethodRepo.save(entity);
  }

  async findAll(clientId: string): Promise<PaymentMethod[]> {
    return this.paymentMethodRepo.find({
      where: { client_id: clientId },
      order: { is_active: 'DESC', method_name: 'ASC' },
    });
  }

  async findOne(clientId: string, id: number): Promise<PaymentMethod> {
    const method = await this.paymentMethodRepo.findOne({ where: { client_id: clientId, id } });
    if (!method) {
      throw new NotFoundException('Payment method not found');
    }
    return method;
  }

  async update(clientId: string, id: number, dto: UpdatePaymentMethodDto): Promise<PaymentMethod> {
    const method = await this.findOne(clientId, id);

    if (dto.method_code || dto.method_name) {
      const nextCode = this.normalizeCode(dto.method_code || method.method_code || this.deriveCode(dto.method_name || method.method_name));
      await this.ensureUniqueCode(clientId, nextCode, id);
      method.method_code = nextCode;
    }

    if (dto.method_name !== undefined) method.method_name = dto.method_name.trim();
    if (dto.description !== undefined) method.description = dto.description?.trim() || null;
    if (dto.is_active !== undefined) method.is_active = dto.is_active;

    return this.paymentMethodRepo.save(method);
  }

  async remove(clientId: string, id: number): Promise<void> {
    const method = await this.findOne(clientId, id);
    method.is_active = false;
    await this.paymentMethodRepo.save(method);
  }
}
