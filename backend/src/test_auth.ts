import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AuthService } from './auth/auth.service';
import { Repository } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  console.log('App loaded.');
  const authService = app.get(AuthService);
  const repo = app.get('UserManagementRepository');
  const user = await repo.findOne({
    where: { user_name: 'ashier1' },
    relations: [
      'roleEntity',
      'client',
      'client.branches',
      'branchRoles',
      'branchRoles.branch',
      'branchRoles.roleEntity',
    ],
  });
  if (!user) {
    const user2 = await repo.findOne({
      where: { user_name: 'cashier1' },
      relations: [
        'roleEntity',
        'client',
        'client.branches',
        'branchRoles',
        'branchRoles.branch',
        'branchRoles.roleEntity',
      ],
    });
    console.log('Found cashier1 instead:', user2?.user_name);
    console.log('BranchRoles:', JSON.stringify(user2?.branchRoles, null, 2));
    if (user2) {
       for (const ubr of (user2.branchRoles ?? [])) {
          console.log('Branch client_id:', ubr.branch?.client_id);
          console.log('User client_id:', user2.client_id);
          console.log('sameClient:', ubr.branch?.client_id === user2.client_id);
       }
       try {
         await authService.validateClientUser('cashier1', '123');
         console.log('Auth SUCCESS for cashier1');
       } catch (e) {
         console.log('Auth ERROR for cashier1:', e.message);
       }
    }
  } else {
     console.log('Found ashier1. BranchRoles:', user.branchRoles);
  }
  process.exit();
}
bootstrap();
