import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vendor } from './entities/vendor.entity';

@Injectable()
export class VendorService {
    constructor(
        @InjectRepository(Vendor)
        private readonly vendorRepo: Repository<Vendor>,
    ) { }

    private normalizeVendorDto(dto: any): any {
        const normalized = { ...dto };
        if (!normalized.email && normalized.contact_email) {
            normalized.email = normalized.contact_email;
        }
        if (!normalized.phone && normalized.contact_phone) {
            normalized.phone = normalized.contact_phone;
        }
        if (!normalized.address && normalized.vendor_address) {
            normalized.address = normalized.vendor_address;
        }
        if (!normalized.contact_email && normalized.email) {
            normalized.contact_email = normalized.email;
        }
        if (!normalized.contact_phone && normalized.phone) {
            normalized.contact_phone = normalized.phone;
        }
        if (!normalized.vendor_address && normalized.address) {
            normalized.vendor_address = normalized.address;
        }
        return normalized;
    }

    async create(clientId: string, dto: any): Promise<Vendor> {
        const normalized = this.normalizeVendorDto(dto);
        const vendor = this.vendorRepo.create({
            client_id: clientId,
            ...normalized,
        } as Partial<Vendor>);
        return this.vendorRepo.save(vendor);
    }

    async findAll(clientId: string): Promise<Vendor[]> {
        return this.vendorRepo.find({
            where: { client_id: clientId },
        });
    }

    async findOne(clientId: string, vendorId: number): Promise<Vendor> {
        const vendor = await this.vendorRepo.findOne({
            where: { id: vendorId, client_id: clientId },
        });
        if (!vendor) throw new NotFoundException('Vendor not found');
        return vendor;
    }

    async update(clientId: string, vendorId: number, dto: any): Promise<Vendor> {
        const normalized = this.normalizeVendorDto(dto);
        const vendor = await this.findOne(clientId, vendorId);
        Object.assign(vendor, normalized);
        return this.vendorRepo.save(vendor);
    }

    async remove(clientId: string, vendorId: number): Promise<void> {
        const vendor = await this.findOne(clientId, vendorId);
        await this.vendorRepo.remove(vendor);
    }
}
