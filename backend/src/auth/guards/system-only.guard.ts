import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class SystemOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request?.user;

    if (user?.is_system === true || user?.user_type === 'system') {
      return true;
    }

    throw new ForbiddenException('Nexus access is restricted to platform administrators.');
  }
}
