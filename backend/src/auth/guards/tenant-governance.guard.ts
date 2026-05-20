import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ClientGovernanceService } from '../../platform/clients/client-governance.service';

@Injectable()
export class TenantGovernanceGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly clientGovernanceService: ClientGovernanceService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || user.is_system || !user.client_id) {
      return true;
    }

    await this.clientGovernanceService.assertRequestAllowed(user.client_id, request.method || 'GET');
    return true;
  }
}
