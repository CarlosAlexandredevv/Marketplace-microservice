import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { sign } from 'jsonwebtoken';
import request from 'supertest';
import { App } from 'supertest/types';
import { E2eSqliteAppModule } from './e2e-sqlite-app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [E2eSqliteAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/health (GET) without token returns Terminus payload', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect((res) => {
        expect([200, 503]).toContain(res.status);
        expect(res.body).toHaveProperty('status');
        if (res.status === 200) {
          expect(res.body.status).toBe('ok');
        }
      });
  });

  it('/ (GET) without token returns 401', () => {
    return request(app.getHttpServer()).get('/').expect(401);
  });

  it('/ (GET) with valid Bearer JWT returns 200', () => {
    const secret = process.env.JWT_SECRET!;
    const token = sign(
      {
        sub: '00000000-0000-4000-8000-000000000001',
        email: 'buyer@test.com',
        role: 'buyer',
      },
      secret,
      { expiresIn: '1h' },
    );

    return request(app.getHttpServer())
      .get('/')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect('Hello World!');
  });

  it('/ (GET) with malformed Bearer token returns 401', () => {
    return request(app.getHttpServer())
      .get('/')
      .set('Authorization', 'Bearer not-a-jwt')
      .expect(401);
  });
});
