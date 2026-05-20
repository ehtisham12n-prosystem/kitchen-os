import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Approval } from './entities/approval.entity';

export interface SubmitApprovalInput {
  client_id: string;
  module: string;
  entity_id: string | number;
  action_type: string;
  requested_by: string | number;
  branch_id?: number | null;
  notes?: string | null;
}

@Injectable()
export class ApprovalsService {
  constructor(
    @InjectRepository(Approval)
    private readonly approvalRepo: Repository<Approval>,
  ) {}

  async submit(input: SubmitApprovalInput): Promise<Approval> {
    const entityId = String(input.entity_id);
    const requestedBy = String(input.requested_by);
    const existing = await this.approvalRepo.findOne({
      where: {
        client_id: input.client_id,
        module: input.module,
        entity_id: entityId,
        action_type: input.action_type,
        status: 'pending',
      },
      order: { id: 'DESC' },
    });

    if (existing) {
      existing.notes = input.notes?.trim() || existing.notes || null;
      existing.branch_id = input.branch_id ?? existing.branch_id ?? null;
      existing.requested_by = requestedBy;
      existing.requested_at = new Date();
      return this.approvalRepo.save(existing);
    }

    return this.approvalRepo.save(
      this.approvalRepo.create({
        client_id: input.client_id,
        module: input.module,
        entity_id: entityId,
        action_type: input.action_type,
        requested_by: requestedBy,
        branch_id: input.branch_id ?? null,
        notes: input.notes?.trim() || null,
        status: 'pending',
        requested_at: new Date(),
      }),
    );
  }

  async decide(
    clientId: string,
    approvalId: number,
    status: 'approved' | 'rejected',
    approvedBy: string | number,
    decisionNotes?: string | null,
  ): Promise<Approval> {
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, client_id: clientId },
    });

    if (!approval) {
      throw new NotFoundException('Approval record not found');
    }

    approval.status = status;
    approval.approved_by = String(approvedBy);
    approval.decision_notes = decisionNotes?.trim() || null;
    approval.reviewed_at = new Date();
    return this.approvalRepo.save(approval);
  }

  async syncDecisionByEntity(
    clientId: string,
    module: string,
    entityId: string | number,
    actionType: string,
    status: 'approved' | 'rejected',
    approvedBy?: string | number | null,
    decisionNotes?: string | null,
  ): Promise<void> {
    const approval = await this.approvalRepo.findOne({
      where: {
        client_id: clientId,
        module,
        entity_id: String(entityId),
        action_type: actionType,
      },
      order: { id: 'DESC' },
    });

    if (!approval) {
      return;
    }

    approval.status = status;
    approval.approved_by = approvedBy !== undefined && approvedBy !== null ? String(approvedBy) : approval.approved_by;
    approval.decision_notes = decisionNotes?.trim() || approval.decision_notes || null;
    approval.reviewed_at = new Date();
    await this.approvalRepo.save(approval);
  }

  async getInbox(clientId: string, branchId?: number): Promise<Approval[]> {
    return this.approvalRepo.find({
      where: {
        client_id: clientId,
        status: 'pending',
        ...(branchId ? { branch_id: branchId } : {}),
      },
      order: { created_at: 'DESC' },
    });
  }
}
