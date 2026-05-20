import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
// import { TenantGroupsModule } from '../../tenant-groups/tenant-groups.module';
import { PermissionModule } from '../../entities/permission-module.entity';
import { PermissionPage } from '../../entities/permission-page.entity';
import { RegistryController } from './registry.controller';
import { RegistryService } from './registry.service';

import { SysGroupsModule } from '../sys-groups/sys-groups.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            PermissionModule,
            PermissionPage,
        ]),
        forwardRef(() => SysGroupsModule),
    ],
    controllers: [RegistryController],
    providers: [RegistryService],
    exports: [RegistryService],
})
export class RegistryModule { }
