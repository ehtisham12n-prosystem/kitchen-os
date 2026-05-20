import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { RegistryService } from '../platform/security/registry/registry.service';
import { SysGroupsService } from '../platform/security/sys-groups/sys-groups.service';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    
    const registryService = app.get(RegistryService);
    const sysGroupsService = app.get(SysGroupsService);

    console.log('--- Starting Permission Sync ---');
    await registryService.seedAll();
    console.log('Permission Registry Sync Complete.');

    console.log('--- Starting Role Template Sync ---');
    await sysGroupsService.seedDefaults();
    console.log('Role Template Sync Complete.');

    await app.close();
    process.exit(0);
}

bootstrap().catch(err => {
    console.error('Seed synchronization failed:', err);
    process.exit(1);
});
