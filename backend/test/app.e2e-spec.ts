import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/v1/health/live (GET)', () => {
    return request(app.getHttpServer())
      .get('/v1/health/live')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(expect.objectContaining({ status: 'ok' }));
      });
  });

  it('/v1/health/ready (GET)', () => {
    return request(app.getHttpServer())
      .get('/v1/health/ready')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(expect.objectContaining({ status: 'ready' }));
      });
  });
});
