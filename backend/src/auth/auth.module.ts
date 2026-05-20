import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';

import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformModule } from '../platform/platform.module';
import { SetupModule } from '../setup/setup.module';
import { Client } from '../platform/entities/client.entity';
import { Role } from '../setup/entities/Roles.entity';
import { UserManagement } from '../setup/entities/UserManagement.entity';
import { UserBranchRole } from '../setup/entities/user-branch-role.entity';
import { UserBranchPermission } from '../setup/entities/user-branch-permission.entity';
import { Permission } from '../setup/entities/permission.entity';
import { RolePermission } from '../setup/entities/role-permission.entity';
import { UserRole } from '../setup/entities/user-role.entity';
import { Customer } from '../customers/entities/customer.entity';
import { AuthAudit } from './entities/auth-audit.entity';
import { PermissionResolverService } from './services/permission-resolver.service';
import { EntitlementsModule } from '../platform/entitlements/entitlements.module';
import { AuthSession } from './entities/auth-session.entity';
import { AuthAccessLog } from './entities/auth-access-log.entity';
import { AuthSecurityService } from './auth-security.service';
import { resolveJwtExpiresIn } from './security-policy.util';
import { getJwtSecret } from '../config/runtime-security.config';

const jwtSecret = getJwtSecret();

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: jwtSecret,
      signOptions: { expiresIn: resolveJwtExpiresIn() as any },
    }),
    TypeOrmModule.forFeature([
      UserManagement,
      Client,
      Role,
      UserBranchRole,
      UserBranchPermission,
      Permission,
      RolePermission,
      UserRole,
      Customer,
      AuthAudit,
      AuthSession,
      AuthAccessLog,
    ]),
    PlatformModule,
    SetupModule,
    EntitlementsModule,
  ],
  providers: [AuthService, AuthSecurityService, JwtStrategy, PermissionResolverService],
  controllers: [AuthController],
  exports: [AuthService, AuthSecurityService, PermissionResolverService],
})
export class AuthModule { }
