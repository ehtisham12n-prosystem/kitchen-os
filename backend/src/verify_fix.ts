import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AuthService } from './auth/auth.service';
import { Repository } from 'typeorm';
import { UserManagement } from './setup/entities/UserManagement.entity';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  console.log('App loaded.');
  const authService = app.get(AuthService);
  const repo = app.get('UserManagementRepository') as Repository<UserManagement>;

  console.log('Verification 1: Login with cashier1');
  try {
     const res = await authService.validateClientUser('cashier1', '123');
     console.log('Login SUCCESS for cashier1. Assigned branches:', res.allowed_branches.length);
  } catch (e) {
     console.log('Login FAILED for cashier1:', e.message);
  }

  console.log('Verification 2: Shared Email (Creating user with existing email)');
  const existingEmail = 'testscopebug6@example.com'; 
  try {
     const newUser = repo.create({
        user_name: 'test_email_shared',
        email: existingEmail,
        password_hash: 'dummy',
        client_id: 'CL-80517',
        user_type: 'BRANCH_STAFF'
     });
     await repo.save(newUser);
     console.log('Shared email record saved successfully.');
     await repo.delete({ user_name: 'test_email_shared' });
  } catch (e) {
     console.log('Shared email record save FAILED:', e.message);
  }

  console.log('Verification 3: Duplicate Username per Client');
  try {
     const dupUser = repo.create({
        user_name: 'cashier1',
        email: 'another@example.com',
        password_hash: 'dummy',
        client_id: 'CL-80517',
        user_type: 'BRANCH_STAFF'
     });
     await repo.save(dupUser);
     console.log('Duplicate username record saved UNEXPECTEDLY.');
  } catch (e) {
     console.log('Duplicate username record save BLOCKED as expected:', e.message);
  }

  process.exit();
}
bootstrap();
