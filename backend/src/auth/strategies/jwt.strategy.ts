import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../payloads/jwt-payload.interface';
import { AuthSecurityService } from '../auth-security.service';
import { getJwtSecret } from '../../config/runtime-security.config';
import { normalizeClientIdentifier } from '../../platform/client-lookup.util';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authSecurityService: AuthSecurityService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: JwtPayload) {
    const sessionId = payload.session_id ?? payload.jti ?? null;
    if (sessionId) {
      await this.authSecurityService.ensureSessionActive(sessionId);
    }

    // This payload is automatically attached to the request object (req.user)
    return {
      sub: payload.sub ?? payload.userId,
      userId: payload.sub,
      username: payload.username,
      email: payload.email,
      client_id: payload.client_id ? normalizeClientIdentifier(payload.client_id) : payload.client_id,
      role: payload.role,
      // New RBAC contract: array of branches the user has access to
      allowed_branches: payload.allowed_branches ?? [],
      effective_permissions: payload.effective_permissions ?? [],
      allowed_modules: payload.allowed_modules ?? [],
      branch_id: payload.branch_id,
      active_branch_id: payload.active_branch_id ?? payload.branch_id,
      user_type: payload.user_type,
      organization_user_type: payload.organization_user_type,
      is_system: payload.is_system ?? false,
      session_id: sessionId,
      jti: sessionId,
    };
  }
}
