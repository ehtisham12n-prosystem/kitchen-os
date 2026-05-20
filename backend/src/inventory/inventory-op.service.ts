import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { StockLedger } from '../inventory-op/entities/stock-ledger.entity';
import { StockLevel } from '../inventory-op/entities/stock-level.entity';
import { InventoryItem } from './entities/inventory-item.entity';
import { Vendor } from './entities/vendor.entity';
import { Branch } from '../setup/entities/branch.entity';
import { AdjustStockDto, CreatePurchaseOrderDto } from '../inventory-op/dto/inventory-op.dto';
import { OperationalAuditService } from '../platform/audit/operational-audit.service';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';

@Injectable()
export class InventoryOpService {
    constructor(
        private dataSource: DataSource,
        @InjectRepository(PurchaseOrder)
        private poRepo: Repository<PurchaseOrder>,
        @InjectRepository(PurchaseOrderItem)
        private poItemRepo: Repository<PurchaseOrderItem>,
        @InjectRepository(StockMovement)
        private movementRepo: Repository<StockMovement>,
        @InjectRepository(StockLedger)
        private ledgerRepo: Repository<StockLedger>,
        @InjectRepository(StockLevel)
        private levelRepo: Repository<StockLevel>,
        @InjectRepository(InventoryItem)
        private itemRepo: Repository<InventoryItem>,
        @InjectRepository(Vendor)
        private vendorRepo: Repository<Vendor>,
        @InjectRepository(Branch)
        private branchRepo: Repository<Branch>,
        private readonly operationalAuditService: OperationalAuditService,
    ) {}

    private buildSystemUser(clientId: string, branchId: number, userId?: string | number): JwtPayload {
        return {
            sub: userId ?? 'system',
            client_id: clientId,
            branch_id: branchId,
            role: 'system',
            user_type: 'system',
        };
    }

    private async assertBranchBelongsToClient(clientId: string, branchId: number): Promise<Branch> {
        const branch = await this.branchRepo.findOne({ where: { id: branchId, client_id: clientId } });
        if (!branch) {
            throw new NotFoundException('Branch not found');
        }
        return branch;
    }

    private async assertItemBelongsToClient(clientId: string, itemId: number): Promise<InventoryItem> {
        const item = await this.itemRepo.findOne({ where: { id: itemId, client_id: clientId } });
        if (!item) {
            throw new NotFoundException(`Inventory item ${itemId} not found`);
        }
        return item;
    }

    private async assertVendorBelongsToClient(clientId: string, vendorId?: number | null): Promise<void> {
        if (!vendorId) {
            return;
        }

        const vendor = await this.vendorRepo.findOne({ where: { id: vendorId, client_id: clientId } });
        if (!vendor) {
            throw new BadRequestException(`Vendor ${vendorId} does not belong to this client`);
        }
    }

    private getDestinationBranchId(po?: Pick<PurchaseOrder, 'branch_id' | 'destination_branch_id'> | null): number | null {
        if (!po) {
            return null;
        }
        return po.destination_branch_id ?? po.branch_id;
    }

    async getBranchStock(clientId: string, branchId: number) {
        await this.assertBranchBelongsToClient(clientId, branchId);
        return this.levelRepo.find({
            where: { client_id: clientId, branch_id: branchId },
            relations: ['item'],
        });
    }

    private normalizeTransactionType(type?: string): string {
        const normalized = (type || '').toLowerCase();
        const allowed = new Set([
            'purchase',
            'sale',
            'adjustment',
            'transfer',
            'wastage',
            'production',
        ]);
        return allowed.has(normalized) ? normalized : 'adjustment';
    }

    async adjustStock(
        clientId: string,
        branchId: number,
        dto: AdjustStockDto & { user_id?: string },
    ) {
        await this.assertBranchBelongsToClient(clientId, branchId);
        await this.assertItemBelongsToClient(clientId, dto.item_id);

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            let stockLevel = await queryRunner.manager.findOne(StockLevel, {
                where: { client_id: clientId, branch_id: branchId, item_id: dto.item_id },
            });

            if (!stockLevel) {
                stockLevel = queryRunner.manager.create(StockLevel, {
                    client_id: clientId,
                    branch_id: branchId,
                    item_id: dto.item_id,
                    current_quantity: 0,
                });
            }

            stockLevel.current_quantity = Number(stockLevel.current_quantity) + Number(dto.quantity);
            await queryRunner.manager.save(stockLevel);

            const ledgerEntry = queryRunner.manager.create(StockLedger, {
                client_id: clientId,
                branch_id: branchId,
                item_id: dto.item_id,
                quantity: dto.quantity,
                transaction_type: this.normalizeTransactionType(dto.type),
                reference_id: dto.reason || dto.notes || undefined,
                unit_cost: 0,
            });
            await queryRunner.manager.save(ledgerEntry);

            await queryRunner.commitTransaction();

            await this.operationalAuditService.log({
                user: this.buildSystemUser(clientId, branchId, dto.user_id),
                action: 'Inventory Adjustment',
                entity: 'inventory_stock_ledger',
                clientId,
                branchId,
                entityId: dto.item_id,
                details: dto.reason || dto.notes || 'Manual stock adjustment',
                metadata: {
                    quantity: dto.quantity,
                    transaction_type: this.normalizeTransactionType(dto.type),
                },
            });

            return stockLevel;
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        } finally {
            await queryRunner.release();
        }
    }

    private mapCanonicalStatusToLegacy(status?: string): string | undefined {
        if (!status) return undefined;
        return status === 'sent' ? 'ordered' : status;
    }

    private normalizePoDto(dto: CreatePurchaseOrderDto): CreatePurchaseOrderDto {
        const normalized = { ...dto };
        normalized.expected_delivery_date =
            normalized.expected_delivery_date ?? normalized.expected_date ?? undefined;
        normalized.total_amount =
            normalized.total_amount ?? normalized.total_cost ?? undefined;
        normalized.po_number = normalized.po_number ?? `PO-${Date.now()}`;
        normalized.status = normalized.status ?? 'draft';
        return normalized;
    }

    async createPO(clientId: string, branchId: number, dto: CreatePurchaseOrderDto) {
        if (dto.branch_id && Number(dto.branch_id) !== Number(branchId)) {
            throw new BadRequestException('branch_id does not match the active branch');
        }

        const destinationBranchId = Number(dto.destination_branch_id || branchId);

        await this.assertBranchBelongsToClient(clientId, branchId);
        await this.assertBranchBelongsToClient(clientId, destinationBranchId);
        await this.assertVendorBelongsToClient(clientId, dto.vendor_id ?? null);
        for (const item of dto.items ?? []) {
            await this.assertItemBelongsToClient(clientId, item.item_id);
        }

        const normalized = this.normalizePoDto(dto);

        const po = await this.dataSource.transaction(async (manager) => {
            let computedTotal = 0;
            if (normalized.items && Array.isArray(normalized.items)) {
                for (const item of normalized.items) {
                    computedTotal += Number(item.quantity) * Number(item.unit_cost);
                }
            }

            const createdPo = manager.create(PurchaseOrder, {
                client_id: clientId,
                branch_id: branchId,
                destination_branch_id: destinationBranchId,
                vendor_id: normalized.vendor_id ?? undefined,
                po_number: normalized.po_number,
                status: normalized.status,
                total_amount: normalized.total_amount ?? computedTotal,
                expected_delivery_date: normalized.expected_delivery_date,
                notes: normalized.notes ?? undefined,
                destination_store_label: normalized.destination_store_label ?? null,
                procurement_mode:
                    normalized.procurement_mode ?? (
                        destinationBranchId === branchId ? 'branch_direct' : 'central_procurement'
                    ),
                approval_status:
                    normalized.approval_status ?? (
                        normalized.procurement_request_id || destinationBranchId !== branchId
                            ? 'pending'
                            : 'not_required'
                    ),
                approval_notes: normalized.approval_notes ?? null,
                procurement_request_id: normalized.procurement_request_id ?? null,
                legacy_status: this.mapCanonicalStatusToLegacy(normalized.status),
                legacy_total_cost: normalized.total_amount ?? computedTotal,
                legacy_expected_date: normalized.expected_delivery_date,
            });
            const savedPo = await manager.save(createdPo);

            for (const item of normalized.items ?? []) {
                const lineTotal = Number(item.quantity) * Number(item.unit_cost);
                const poItem = manager.create(PurchaseOrderItem, {
                    po_id: savedPo.id,
                    item_id: item.item_id,
                    quantity: item.quantity,
                    unit_cost: item.unit_cost,
                    line_total: lineTotal,
                    legacy_total_price: lineTotal,
                });
                await manager.save(poItem);
            }

            return savedPo;
        });

        return this.poRepo.findOne({
            where: { id: po.id, client_id: clientId },
            relations: ['items', 'vendor', 'branch'],
        });
    }

    async receivePO(clientId: string, branchId: number, poId: number, userId?: string) {
        await this.assertBranchBelongsToClient(clientId, branchId);

        const po = await this.poRepo.findOne({
            where: { id: poId, client_id: clientId },
            relations: ['items'],
        });

        if (!po) throw new NotFoundException('Purchase Order not found');
        if (this.getDestinationBranchId(po) !== branchId) {
            throw new BadRequestException('Receive branch does not match the purchase order destination');
        }
        if (['pending', 'rejected'].includes(po.approval_status)) {
            throw new BadRequestException('This purchase order must be approved before it can be received');
        }
        if (po.status === 'received') throw new BadRequestException('PO already received');

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            for (const poItem of po.items) {
                await this.assertItemBelongsToClient(clientId, poItem.item_id);

                let stockLevel = await queryRunner.manager.findOne(StockLevel, {
                    where: { client_id: clientId, branch_id: branchId, item_id: poItem.item_id },
                });

                if (!stockLevel) {
                    stockLevel = queryRunner.manager.create(StockLevel, {
                        client_id: clientId,
                        branch_id: branchId,
                        item_id: poItem.item_id,
                        current_quantity: 0,
                    });
                }

                stockLevel.current_quantity = Number(stockLevel.current_quantity) + Number(poItem.quantity);
                await queryRunner.manager.save(stockLevel);

                const ledgerEntry = queryRunner.manager.create(StockLedger, {
                    client_id: clientId,
                    branch_id: branchId,
                    item_id: poItem.item_id,
                    quantity: poItem.quantity,
                    transaction_type: 'purchase',
                    reference_id: po.po_number || `PO-${po.id}`,
                    unit_cost: poItem.unit_cost ?? 0,
                });
                await queryRunner.manager.save(ledgerEntry);
            }

            po.status = 'received';
            po.legacy_status = 'received';
            await queryRunner.manager.save(po);

            await queryRunner.commitTransaction();

            await this.operationalAuditService.log({
                user: this.buildSystemUser(clientId, branchId, userId),
                action: 'Inventory Receipt',
                entity: 'inventory_stock_ledger',
                clientId,
                branchId,
                entityId: po.id,
                details: `Received purchase order ${po.po_number || po.id}`,
                metadata: {
                    po_id: po.id,
                    item_count: po.items.length,
                },
            });

            return po;
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        } finally {
            await queryRunner.release();
        }
    }

    async getStockLedger(clientId: string, branchId: number, itemId?: number) {
        await this.assertBranchBelongsToClient(clientId, branchId);
        if (itemId) {
            await this.assertItemBelongsToClient(clientId, itemId);
        }

        const where: any = { client_id: clientId, branch_id: branchId };
        if (itemId) where.item_id = itemId;

        const ledger = await this.ledgerRepo.find({
            where,
            relations: ['item'],
            order: { created_at: 'DESC' },
            take: 100,
        });

        if (ledger.length > 0) {
            return ledger;
        }

        const legacyWhere: any = { branch_id: branchId };
        if (itemId) legacyWhere.item_id = itemId;
        const legacy = await this.movementRepo.find({
            where: legacyWhere,
            relations: ['item'],
            order: { created_at: 'DESC' },
            take: 100,
        });

        return legacy.map((entry) => ({
            id: entry.id,
            client_id: clientId,
            branch_id: entry.branch_id,
            item_id: entry.item_id,
            item: entry.item,
            quantity: entry.quantity,
            transaction_type: entry.type,
            reference_id: entry.reference_id,
            unit_cost: 0,
            created_at: entry.created_at,
        }));
    }
}
