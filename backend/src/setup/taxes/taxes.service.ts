import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaxConfiguration } from '../entities/tax-configuration.entity';
import {
  CreateTaxConfigurationDto,
  PaymentTypeRatesDto,
  UpdateTaxConfigurationDto,
} from './dto/tax.dto';

@Injectable()
export class TaxesService {
  constructor(
    @InjectRepository(TaxConfiguration)
    private readonly taxRepo: Repository<TaxConfiguration>,
  ) {}

  private normalizeCode(code: string): string {
    return code
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private normalizeRegistrationNumber(value: string): string {
    return value.trim();
  }

  private normalizePaymentTypeRates(
    value?: PaymentTypeRatesDto | Record<string, number> | null,
  ): Record<string, number> | null {
    if (!value) {
      return null;
    }

    const entries = Object.entries(value)
      .filter(([, rate]) => rate !== undefined && rate !== null && Number.isFinite(Number(rate)))
      .map(([paymentType, rate]) => [paymentType, Number(rate)]);

    return entries.length > 0 ? Object.fromEntries(entries) : null;
  }

  private async ensureUniqueCode(
    clientId: string,
    taxCode: string,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.taxRepo.findOne({
      where: {
        client_id: clientId,
        tax_code: this.normalizeCode(taxCode),
      },
    });

    if (existing && existing.id !== excludeId) {
      throw new BadRequestException(`Tax code ${this.normalizeCode(taxCode)} already exists.`);
    }
  }

  private async clearExistingDefault(clientId: string, excludeId?: number): Promise<void> {
    const existingDefault = await this.taxRepo.find({
      where: { client_id: clientId, is_default: true },
    });

    for (const record of existingDefault) {
      if (excludeId && record.id === excludeId) {
        continue;
      }
      record.is_default = false;
      await this.taxRepo.save(record);
    }
  }

  async create(clientId: string, dto: CreateTaxConfigurationDto): Promise<TaxConfiguration> {
    await this.ensureUniqueCode(clientId, dto.tax_code);

    if (dto.is_default) {
      await this.clearExistingDefault(clientId);
    }

    const entity = this.taxRepo.create({
      client_id: clientId,
      ...dto,
      tax_code: this.normalizeCode(dto.tax_code),
      tax_registration_number: this.normalizeRegistrationNumber(dto.tax_registration_number),
      calculation_method: dto.calculation_method ?? 'percentage',
      payment_type_rates: this.normalizePaymentTypeRates(dto.payment_type_rates),
      is_active: dto.is_active ?? true,
      is_default: dto.is_default ?? false,
      applies_to_dine_in: dto.applies_to_dine_in ?? true,
      applies_to_takeout: dto.applies_to_takeout ?? true,
      applies_to_delivery: dto.applies_to_delivery ?? true,
    });

    return this.taxRepo.save(entity);
  }

  async findAll(clientId: string): Promise<TaxConfiguration[]> {
    return this.taxRepo.find({
      where: { client_id: clientId },
      order: {
        is_default: 'DESC',
        tax_name: 'ASC',
      },
    });
  }

  async findOne(clientId: string, id: number): Promise<TaxConfiguration> {
    const tax = await this.taxRepo.findOne({
      where: { client_id: clientId, id },
    });
    if (!tax) {
      throw new NotFoundException('Tax configuration not found');
    }
    return tax;
  }

  async update(
    clientId: string,
    id: number,
    dto: UpdateTaxConfigurationDto,
  ): Promise<TaxConfiguration> {
    const tax = await this.findOne(clientId, id);

    if (dto.tax_code && dto.tax_code !== tax.tax_code) {
      await this.ensureUniqueCode(clientId, dto.tax_code, id);
      tax.tax_code = this.normalizeCode(dto.tax_code);
    }

    if (dto.is_default) {
      await this.clearExistingDefault(clientId, id);
    }

    Object.assign(tax, {
      ...dto,
      tax_code: tax.tax_code,
      tax_registration_number: dto.tax_registration_number !== undefined
        ? this.normalizeRegistrationNumber(dto.tax_registration_number)
        : tax.tax_registration_number,
      payment_type_rates: dto.payment_type_rates !== undefined
        ? this.normalizePaymentTypeRates(dto.payment_type_rates)
        : tax.payment_type_rates,
    });

    if (dto.is_active === false && tax.is_default) {
      tax.is_default = false;
    }

    return this.taxRepo.save(tax);
  }

  async remove(clientId: string, id: number): Promise<void> {
    const tax = await this.findOne(clientId, id);
    tax.is_active = false;
    tax.is_default = false;
    await this.taxRepo.save(tax);
  }
}
