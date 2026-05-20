import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vendor } from '../entities/vendor.entity';
import { CreateVendorDto, UpdateVendorDto } from '../dto/inventory-write.dto';
import { PurchaseOrder } from '../entities/purchase-order.entity';

@Injectable()
export class VendorsService implements OnModuleInit {
    constructor(
        @InjectRepository(Vendor)
        private vendorRepo: Repository<Vendor>,
        @InjectRepository(PurchaseOrder)
        private readonly purchaseOrderRepo: Repository<PurchaseOrder>,
    ) {}

    async onModuleInit() {
        await this.backfillLegacyVendorColumns();
    }

    private normalizeVendorDto(dto: CreateVendorDto | UpdateVendorDto): CreateVendorDto | UpdateVendorDto {
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

    private async backfillLegacyVendorColumns(): Promise<void> {
        try {
            await this.vendorRepo.query(
                'UPDATE vendors SET email = contact_email WHERE (email IS NULL OR email = \'\') AND contact_email IS NOT NULL',
            );
            await this.vendorRepo.query(
                'UPDATE vendors SET phone = contact_phone WHERE (phone IS NULL OR phone = \'\') AND contact_phone IS NOT NULL',
            );
            await this.vendorRepo.query(
                'UPDATE vendors SET address = vendor_address WHERE (address IS NULL OR address = \'\') AND vendor_address IS NOT NULL',
            );
            await this.vendorRepo.query(
                'UPDATE vendors SET contact_email = email WHERE (contact_email IS NULL OR contact_email = \'\') AND email IS NOT NULL',
            );
            await this.vendorRepo.query(
                'UPDATE vendors SET contact_phone = phone WHERE (contact_phone IS NULL OR contact_phone = \'\') AND phone IS NOT NULL',
            );
            await this.vendorRepo.query(
                'UPDATE vendors SET vendor_address = address WHERE (vendor_address IS NULL OR vendor_address = \'\') AND address IS NOT NULL',
            );
        } catch (error) {
            console.warn('[VendorsService] Legacy vendor column backfill skipped:', error?.message ?? error);
        }
    }

    async create(clientId: string, dto: CreateVendorDto): Promise<Vendor> {
        const normalized = this.normalizeVendorDto(dto);
        const vendor = this.vendorRepo.create({
            client_id: clientId,
            ...normalized,
        });
        return this.vendorRepo.save(vendor);
    }

    private async buildUsageSummary(clientId: string): Promise<Map<number, any>> {
        const aggregateRows = await this.purchaseOrderRepo
            .createQueryBuilder('po')
            .select('po.vendor_id', 'vendor_id')
            .addSelect('COUNT(po.id)', 'purchase_order_count')
            .addSelect('COUNT(DISTINCT COALESCE(po.destination_branch_id, po.branch_id))', 'branch_count')
            .addSelect('MAX(po.updated_at)', 'last_order_at')
            .where('po.client_id = :clientId', { clientId })
            .andWhere('po.vendor_id IS NOT NULL')
            .groupBy('po.vendor_id')
            .getRawMany();

        const branchRows = await this.purchaseOrderRepo
            .createQueryBuilder('po')
            .leftJoin('po.destination_branch', 'destination_branch')
            .leftJoin('po.branch', 'requesting_branch')
            .select('po.vendor_id', 'vendor_id')
            .addSelect('COALESCE(destination_branch.id, requesting_branch.id)', 'branch_id')
            .addSelect('COALESCE(destination_branch.branch_name, requesting_branch.branch_name)', 'branch_name')
            .where('po.client_id = :clientId', { clientId })
            .andWhere('po.vendor_id IS NOT NULL')
            .groupBy('po.vendor_id')
            .addGroupBy('COALESCE(destination_branch.id, requesting_branch.id)')
            .addGroupBy('COALESCE(destination_branch.branch_name, requesting_branch.branch_name)')
            .getRawMany();

        const summaryMap = new Map<number, any>();

        for (const row of aggregateRows) {
            summaryMap.set(Number(row.vendor_id), {
                purchase_order_count: Number(row.purchase_order_count ?? 0),
                branch_count: Number(row.branch_count ?? 0),
                last_order_at: row.last_order_at ?? null,
                branch_names: [],
            });
        }

        for (const row of branchRows) {
            const vendorId = Number(row.vendor_id);
            const summary = summaryMap.get(vendorId) ?? {
                purchase_order_count: 0,
                branch_count: 0,
                last_order_at: null,
                branch_names: [],
            };
            const branchName = row.branch_name ? String(row.branch_name) : null;
            if (branchName && !summary.branch_names.includes(branchName)) {
                summary.branch_names.push(branchName);
            }
            summaryMap.set(vendorId, summary);
        }

        return summaryMap;
    }

    async findAll(clientId: string): Promise<Vendor[]> {
        const [vendors, usageSummary] = await Promise.all([
            this.vendorRepo.find({
                where: { client_id: clientId },
                order: { vendor_name: 'ASC' },
            }),
            this.buildUsageSummary(clientId),
        ]);

        return vendors.map((vendor) => Object.assign(vendor, {
            usage_summary: usageSummary.get(vendor.id) ?? {
                purchase_order_count: 0,
                branch_count: 0,
                last_order_at: null,
                branch_names: [],
            },
        })) as Vendor[];
    }

    async findOne(clientId: string, id: number): Promise<Vendor> {
        const [vendor, usageSummary] = await Promise.all([
            this.vendorRepo.findOne({
                where: { id, client_id: clientId },
            }),
            this.buildUsageSummary(clientId),
        ]);
        if (!vendor) throw new NotFoundException('Vendor not found');
        return Object.assign(vendor, {
            usage_summary: usageSummary.get(vendor.id) ?? {
                purchase_order_count: 0,
                branch_count: 0,
                last_order_at: null,
                branch_names: [],
            },
        });
    }

    async update(clientId: string, id: number, dto: UpdateVendorDto): Promise<Vendor> {
        const normalized = this.normalizeVendorDto(dto);
        await this.vendorRepo.update({ id, client_id: clientId }, normalized);
        return this.findOne(clientId, id);
    }

    async delete(clientId: string, id: number): Promise<void> {
        const vendor = await this.vendorRepo.findOne({
            where: { id, client_id: clientId },
        });
        if (!vendor) {
            throw new NotFoundException('Vendor not found');
        }
        if (vendor.is_active !== false) {
            vendor.is_active = false;
            await this.vendorRepo.save(vendor);
        }
    }
}
