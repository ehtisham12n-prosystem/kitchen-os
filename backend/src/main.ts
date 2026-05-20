import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import express from 'express';
import path from 'path';
import { AppModule } from './app.module';
import { getNumberEnv } from './config/env.config';
import {
  assertRuntimeSecurityConfig,
  buildCorsOptions,
} from './config/runtime-security.config';

async function bootstrap() {
  assertRuntimeSecurityConfig();
  const app = await NestFactory.create(AppModule);
  app.enableCors(buildCorsOptions());
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  await app.listen(getNumberEnv('PORT', 3000));
}
bootstrap();
