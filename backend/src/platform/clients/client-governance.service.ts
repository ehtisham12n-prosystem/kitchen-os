import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { JwtPayload } from '../../auth/payloads/jwt-payload.interface';
import { resolveActorId } from '../../auth/request-context.util';
import { buildClientLookupWhere } from '../client-lookup.util';
import { OperationalAuditService } from '../audit/operational-audit.service';
import { ClientGovernanceHistory } from '../entities/client-governance-history.entity';
import {
  Client,
  ClientGovernanceContext,
  ClientGovernanceState,
} from '../entities/client.entity';
import {
  ChangeClientGovernanceDto,
  ClientGovernanceStatus,
} from './dto/client-governance.dto';

type GovernanceActionType =
  | 'reactivate_client'
  | 'restrict_client'
  | 'suspend_client'
  | 'mark_closure_pending'
  | 'close_client'
  | 'update_governance';

interface GovernanceAccessDecision {
  state: ClientGovernanceState;
  mode: 'full' | 'read_only' | 'blocked';
  allow: boolean;
  message: string | null;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const ALLOWED_GOVERNANCE_TRANSITIONS: Record<ClientGovernanceState, ClientGovernanceState[]> = {
  normal: ['restricted', 'suspended', 'closure_pending', 'closed'],
  restricted: ['normal', 'suspended', 'closure_pending', 'closed'],
  suspended: ['normal', 'restricted', 'closure_pending', 'closed'],
  closure_pending: ['normal', 'suspended', 'closed'],
  closed: [],
};

@Injectable()
export class ClientGovernanceService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(ClientGovernanceHistory)
    private readonly governanceHistoryRepository: Repository<ClientGovernanceHistory>,
    private readonly operationalAuditService: OperationalAuditService,
  ) {}

  async getGovernance(clientId: string): Promise<any> {
    const client = await this.getClientOrFail(clientId);
    return this.serializeGovernance(client);
  }

  async getGovernanceHistory(clientId: string): Promise<ClientGovernanceHistory[]> {
    await this.ensureClientExists(clientId);
    return this.governanceHistoryRepository.find({
      where: { client_id: clientId },
      order: { created_at: 'DESC', id: 'DESC' },
    });
  }

  async changeGovernance(
    clientId: string,
    dto: ChangeClientGovernanceDto,
    user?: JwtPayload,
  ): Promise<any> {
    const client = await this.getClientOrFail(clientId);
    const actorId = resolveActorId(user) ?? null;
    const currentState = (client.governance_state || 'normal') as ClientGovernanceState;
    const currentContext = (client.governance_context || null) as ClientGovernanceContext | null;
    const targetState = dto.state as ClientGovernanceStatus;

    if (currentState === targetState) {
      throw new BadRequestException(`Governance state is already ${targetState}`);
    }

    const allowedTransitions = ALLOWED_GOVERNANCE_TRANSITIONS[currentState] || [];
    if (!allowedTransitions.includes(targetState)) {
      throw new BadRequestException(`Governance transition from ${currentState} to ${targetState} is not allowed`);
    }

    this.assertLifecycleCompatibility(client, targetState);

    client.governance_state = targetState;
    client.governance_context = dto.trigger_context;
    client.governance_reason = dto.reason.trim();
    client.governance_notes = dto.notes?.trim() || null;
    client.governance_updated_at = new Date();
    client.governance_updated_by = actorId;
    await this.clientRepository.save(client);

    const actionType = this.resolveActionType(targetState);
    await this.governanceHistoryRepository.save(
      this.governanceHistoryRepository.create({
        client_id: clientId,
        action_type: actionType,
        from_state: currentState,
        to_state: targetState,
        trigger_context: dto.trigger_context,
        reason: dto.reason.trim(),
        notes: dto.notes?.trim() || null,
        changed_by: actorId,
      }),
    );

    await this.operationalAuditService.log({
      user,
      action: 'Update Client Governance',
      entity: 'ClientGovernance',
      clientId,
      entityId: clientId,
      portal: 'Nexus',
      details: `Client governance moved from ${currentState} to ${targetState}`,
      metadata: {
        trigger_context: dto.trigger_context,
        reason: dto.reason.trim(),
        notes: dto.notes?.trim() || null,
      },
      diff: [
        { field: 'governance_state', oldValue: currentState, newValue: targetState },
        { field: 'governance_context', oldValue: currentContext, newValue: dto.trigger_context },
      ],
    });

    return this.serializeGovernance(client);
  }

  async assertRequestAllowed(clientId: string, method: string): Promise<GovernanceAccessDecision> {
    const client = await this.getClientOrFail(clientId);
    const decision = this.evaluateLoadedClientAccess(client, method);
    if (!decision.allow) {
      throw new ForbiddenException(decision.message || 'Tenant access is blocked by platform governance');
    }
    return decision;
  }

  evaluateLoadedClientAccess(client: Pick<Client, 'governance_state' | 'governance_context'>, method: string): GovernanceAccessDecision {
    const state = (client.governance_state || 'normal') as ClientGovernanceState;
    const context = client.governance_context as ClientGovernanceContext | null;

    if (state === 'normal') {
      return { state, mode: 'full', allow: true, message: null };
    }

    if (state === 'restricted') {
      if (SAFE_METHODS.has(method.toUpperCase())) {
        return { state, mode: 'read_only', allow: true, message: null };
      }
      return {
        state,
        mode: 'read_only',
        allow: false,
        message: this.buildMessage(state, context, 'Write access is blocked by platform governance'),
      };
    }

    return {
      state,
      mode: 'blocked',
      allow: false,
      message: this.buildMessage(state, context, 'Tenant access is blocked by platform governance'),
    };
  }

  evaluateLoginAccess(client: Pick<Client, 'governance_state' | 'governance_context'>): GovernanceAccessDecision {
    const state = (client.governance_state || 'normal') as ClientGovernanceState;
    const context = client.governance_context as ClientGovernanceContext | null;

    if (state === 'normal') {
      return { state, mode: 'full', allow: true, message: null };
    }

    if (state === 'restricted') {
      return { state, mode: 'read_only', allow: true, message: null };
    }

    return {
      state,
      mode: 'blocked',
      allow: false,
      message: this.buildMessage(state, context, 'Tenant login is blocked by platform governance'),
    };
  }

  private serializeGovernance(client: Client) {
    const decision = this.evaluateLoadedClientAccess(client, 'GET');
    const currentState = (client.governance_state || 'normal') as ClientGovernanceState;
    return {
      client_id: client.id,
      governance_state: currentState,
      lifecycle_status: client.status,
      trigger_context: client.governance_context || null,
      reason: client.governance_reason || null,
      notes: client.governance_notes || null,
      updated_at: client.governance_updated_at || null,
      updated_by: client.governance_updated_by || null,
      access_mode: decision.mode,
      allowed_next_states: (ALLOWED_GOVERNANCE_TRANSITIONS[currentState] || []).filter((state) =>
        this.isLifecycleCompatible(client, state),
      ),
    };
  }

  private resolveActionType(state: ClientGovernanceState): GovernanceActionType {
    switch (state) {
      case 'normal':
        return 'reactivate_client';
      case 'restricted':
        return 'restrict_client';
      case 'suspended':
        return 'suspend_client';
      case 'closure_pending':
        return 'mark_closure_pending';
      case 'closed':
        return 'close_client';
      default:
        return 'update_governance';
    }
  }

  private buildMessage(
    state: ClientGovernanceState,
    context: ClientGovernanceContext | null,
    fallback: string,
  ): string {
    const contextText = context ? ` (${context.replace(/_/g, ' ')})` : '';
    return `${fallback}: ${state.replace(/_/g, ' ')}${contextText}`;
  }

  private async getClientOrFail(clientId: string): Promise<Client> {
    const client = await this.clientRepository.findOne({ where: buildClientLookupWhere(clientId) });
    if (!client) {
      throw new NotFoundException(`Client with ID ${clientId} not found`);
    }
    return client;
  }

  private async ensureClientExists(clientId: string): Promise<void> {
    const exists = await this.clientRepository.findOne({
      where: buildClientLookupWhere(clientId),
      select: ['id'],
    });
    if (!exists) {
      throw new NotFoundException(`Client with ID ${clientId} not found`);
    }
  }

  private assertLifecycleCompatibility(client: Client, targetState: ClientGovernanceState): void {
    if (!this.isLifecycleCompatible(client, targetState)) {
      throw new BadRequestException(
        `Governance state ${targetState} is not allowed while lifecycle status is ${client.status}`,
      );
    }
  }

  private isLifecycleCompatible(client: Pick<Client, 'status'>, targetState: ClientGovernanceState): boolean {
    if (targetState === 'normal') {
      return client.status !== 'closed';
    }

    if (targetState === 'closed') {
      return ['suspended', 'inactive', 'closed'].includes(client.status);
    }

    return true;
  }
}
