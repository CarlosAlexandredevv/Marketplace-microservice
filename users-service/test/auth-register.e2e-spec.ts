import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/entities/user.entity';
import { createAppValidationPipe } from '../src/validation-pipe.config';

type RegisterSuccessBody = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type ValidationErrorBody = {
  statusCode: number;
  message: string;
  errors: { field: string; messages: string[] }[];
};

function comparePassword(plain: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    bcrypt.compare(plain, hash, (err, same) => {
      if (err) reject(err);
      else resolve(same === true);
    });
  });
}

describe('Auth register (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(createAppValidationPipe());
    await app.init();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  const uniqueEmail = (label: string) =>
    `e2e.${label}.${randomUUID()}@example.com`;

  it('POST /auth/register — 201, sem password, status active, hash bcrypt', async () => {
    const plainPassword = 'secret12';
    const email = uniqueEmail('ok');
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: plainPassword,
        firstName: 'Ada',
        lastName: 'Lovelace',
        role: 'buyer',
      })
      .expect(201);

    const body = res.body as RegisterSuccessBody;
    expect(body).not.toHaveProperty('password');
    expect(body.email).toBe(email.trim().toLowerCase());
    expect(body.status).toBe('active');
    expect(body.role).toBe('buyer');
    expect(body.id).toBeDefined();

    const row = await dataSource.getRepository(User).findOne({
      where: { email: email.trim().toLowerCase() },
    });
    expect(row).not.toBeNull();
    expect(row!.password).not.toBe(plainPassword);
    expect(await comparePassword(plainPassword, row!.password)).toBe(true);
    expect(row!.password.startsWith('$2')).toBe(true);
  });

  it('POST /auth/register — 409 quando e-mail já existe', async () => {
    const email = uniqueEmail('dup');
    const payload = {
      email,
      password: 'secret12',
      firstName: 'A',
      lastName: 'B',
      role: 'seller' as const,
    };

    await request(app.getHttpServer())
      .post('/auth/register')
      .send(payload)
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send(payload)
      .expect(409);

    const count = await dataSource.getRepository(User).count({
      where: { email: email.trim().toLowerCase() },
    });
    expect(count).toBe(1);
  });

  it('POST /auth/register — 409 com mesmo e-mail em outra capitalização', async () => {
    const base = uniqueEmail('case');
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: base.toLowerCase(),
        password: 'secret12',
        firstName: 'A',
        lastName: 'B',
        role: 'buyer',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: base.toUpperCase(),
        password: 'secret12',
        firstName: 'C',
        lastName: 'D',
        role: 'buyer',
      })
      .expect(409);
  });

  it('POST /auth/register — 400 quando senha curta (lista por campo)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: uniqueEmail('shortpwd'),
        password: '12345',
        firstName: 'A',
        lastName: 'B',
        role: 'buyer',
      })
      .expect(400);

    const errBody = res.body as ValidationErrorBody;
    const pwdErr = errBody.errors.find((e) => e.field === 'password');
    expect(pwdErr).toBeDefined();
    expect(pwdErr!.messages.length).toBeGreaterThan(0);
    expect(pwdErr!.messages.some((m) => m.includes('6'))).toBe(true);
  });

  it('AuthModule carregado: rota POST /auth/register responde', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: uniqueEmail('smoke'),
        password: 'secret12',
        firstName: 'S',
        lastName: 'M',
        role: 'seller',
      })
      .expect(201);
  });
});
