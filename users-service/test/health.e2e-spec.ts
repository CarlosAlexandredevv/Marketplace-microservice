import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { E2eSqliteAppModule } from './e2e-sqlite-app.module';
import { createAppValidationPipe } from '../src/validation-pipe.config';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [E2eSqliteAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(createAppValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health — 200 e inclui check do banco', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('info');
    expect(res.body.info).toHaveProperty('postgres');
  });
});
