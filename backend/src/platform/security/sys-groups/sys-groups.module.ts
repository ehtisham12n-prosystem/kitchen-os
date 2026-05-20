import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemGroup } from './entities/system-group.entity';
import { SysGroupsService } from './sys-groups.service';
import { SysGroupsController } from './sys-groups.controller';

@Module({
    imports: [TypeOrmModule.forFeature([SystemGroup])],
    providers: [SysGroupsService],
    controllers: [SysGroupsController],
    exports: [SysGroupsService],
})
export class SysGroupsModule { }
