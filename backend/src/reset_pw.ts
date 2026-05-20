const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('D:/Antigravity/KitchenOS/backend/dist/app.module');
const bcrypt = require('bcrypt');

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  console.log('App loaded.');
  const repo = app.get('UserManagementRepository');
  const user = await repo.findOne({ where: { user_name: 'cashier1' } });
  if (user) {
     console.log('Resetting password for user ID:', user.id);
     const salt = await bcrypt.genSalt();
     const hash = await bcrypt.hash('123', salt);
     await repo.update({ id: user.id }, { password_hash: hash });
     console.log('Password reset to 123 successfully.');
  } else {
     console.log('User cashier1 not found.');
  }
  process.exit();
}
bootstrap();
