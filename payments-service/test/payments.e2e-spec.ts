import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { sign } from 'jsonwebtoken';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import {
  Payment,
  PaymentRecordStatus,
} from '../src/payments/entities/payment.entity';
import { E2eSqliteAppModule } from './e2e-sqlite-app.module';

describe('Payments (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const secret = process.env.JWT_SECRET!;

  function tokenForUser(sub: string): string {
    return sign(
      { sub, email: `${sub}@test.com`, role: 'buyer' },
      secret,
      { expiresIn: '1h' },
    );
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [E2eSqliteAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    dataSource = moduleFixture.get(DataSource);
  });

  afterEach(async () => {
    await dataSource.getRepository(Payment).clear();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /payments/:orderId — 401 sem JWT', () => {
    return request(app.getHttpServer())
      .get(`/payments/${randomUUID()}`)
      .expect(401);
  });

  it('GET /payments/:orderId — 404 quando não existe pagamento', async () => {
    await request(app.getHttpServer())
      .get(`/payments/${randomUUID()}`)
      .set('Authorization', `Bearer ${tokenForUser('user-1')}`)
      .expect(404);
  });

  it('GET /payments/:orderId — 200 quando pagamento pertence ao usuário', async () => {
    const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const orderId = randomUUID();
    await dataSource.getRepository(Payment).save({
      orderId,
      userId,
      amount: '15.00',
      status: PaymentRecordStatus.APPROVED,
    });

    const res = await request(app.getHttpServer())
      .get(`/payments/${orderId}`)
      .set('Authorization', `Bearer ${tokenForUser(userId)}`)
      .expect(200);

    expect(res.body).toMatchObject({
      orderId,
      status: 'approved',
    });
    expect(res.body.id).toBeDefined();
  });

  it('GET /payments/:orderId — 404 quando pedido é de outro usuário', async () => {
    const orderId = randomUUID();
    await dataSource.getRepository(Payment).save({
      orderId,
      userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      amount: '10.00',
      status: PaymentRecordStatus.APPROVED,
    });

    await request(app.getHttpServer())
      .get(`/payments/${orderId}`)
      .set(
        'Authorization',
        `Bearer ${tokenForUser('cccccccc-cccc-4ccc-8ccc-cccccccccccc')}`,
      )
      .expect(404);
  });
});
