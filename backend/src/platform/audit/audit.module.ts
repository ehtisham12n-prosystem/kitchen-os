import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { OperationalAuditService } from './operational-audit.service';

@Module({
    imports: [TypeOrmModule.forFeature([AuditLog])],
    providers: [AuditService, OperationalAuditService],
    controllers: [AuditController],
    exports: [AuditService, OperationalAuditService],
})
export class AuditModule { }
