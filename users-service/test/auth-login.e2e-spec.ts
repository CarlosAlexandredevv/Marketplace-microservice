import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { E2eSqliteAppModule } from './e2e-sqlite-app.module';
import { User, UserStatus } from '../src/users/entities/user.entity';
import { createAppValidationPipe } from '../src/validation-pipe.config';

type LoginSuccessBody = {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  token: string;
};

type ValidationErrorBody = {
  statusCode: number;
  message: string;
  errors: { field: string; messages: string[] }[];
};

function decodeJwtPayload(token: string): Record<string, unknown> {
  const part = token.split('.')[1];
  const json = Buffer.from(part, 'base64url').toString('utf8');
  return JSON.parse(json) as Record<string, unknown>;
}

describe('Auth login (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    expect(process.env.JWT_SECRET?.trim()).toBeDefined();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [E2eSqliteAppModule],
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
    `e2e.login.${label}.${randomUUID()}@example.com`;

  it('POST /auth/login — 200, user sem password, token JWT com sub/email/role e exp ~24h', async () => {
    const plainPassword = 'secret12';
    const email = uniqueEmail('ok');
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: plainPassword,
        firstName: 'Ada',
        lastName: 'Lovelace',
        role: 'buyer',
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: plainPassword })
      .expect(200);

    const body = res.body as LoginSuccessBody;
    expect(body.user).not.toHaveProperty('password');
    expect(body.user.email).toBe(email.trim().toLowerCase());
    expect(body.user.status).toBe('active');
    expect(body.user.role).toBe('buyer');
    expect(typeof body.token).toBe('string');
    expect(body.token.length).toBeGreaterThan(0);

    const payload = decodeJwtPayload(body.token);
    expect(payload.sub).toBe(body.user.id);
    expect(payload.email).toBe(body.user.email);
    expect(payload.role).toBe('buyer');
    expect(typeof payload.iat).toBe('number');
    expect(typeof payload.exp).toBe('number');
    const exp = payload.exp as number;
    const iat = payload.iat as number;
    expect(exp - iat).toBe(24 * 60 * 60);
  });

  it('POST /auth/login — 401 e-mail inexistente (Credenciais inválidas)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: uniqueEmail('missing'),
        password: 'secret12',
      })
      .expect(401);

    expect(res.body).toMatchObject({
      statusCode: 401,
      message: 'Credenciais inválidas',
    });
  });

  it('POST /auth/login — 401 senha incorreta (mesma mensagem)', async () => {
    const email = uniqueEmail('wrongpwd');
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'secret12',
        firstName: 'A',
        lastName: 'B',
        role: 'seller',
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'wrongpwd12' })
      .expect(401);

    expect(res.body).toMatchObject({
      statusCode: 401,
      message: 'Credenciais inválidas',
    });
  });

  it('POST /auth/login — 401 conta inativa, sem token', async () => {
    const plainPassword = 'secret12';
    const email = uniqueEmail('inactive');
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: plainPassword,
        firstName: 'A',
        lastName: 'B',
        role: 'buyer',
      })
      .expect(201);

    await dataSource
      .getRepository(User)
      .update(
        { email: email.trim().toLowerCase() },
        { status: UserStatus.INACTIVE },
      );

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: plainPassword })
      .expect(401);

    expect(res.body).toMatchObject({
      statusCode: 401,
      message: 'Conta inativa',
    });
    expect(res.body).not.toHaveProperty('token');
  });

  it('POST /auth/login — 400 e-mail inválido', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'not-an-email', password: 'secret12' })
      .expect(400);

    const errBody = res.body as ValidationErrorBody;
    const emailErr = errBody.errors.find((e) => e.field === 'email');
    expect(emailErr).toBeDefined();
  });

  it('POST /auth/login — 400 senha curta', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: uniqueEmail('shortpwd'),
        password: '12345',
      })
      .expect(400);

    const errBody = res.body as ValidationErrorBody;
    const pwdErr = errBody.errors.find((e) => e.field === 'password');
    expect(pwdErr).toBeDefined();
    expect(pwdErr!.messages.some((m) => m.includes('6'))).toBe(true);
  });

  it('POST /auth/login — aceita e-mail com capitalização diferente do cadastro', async () => {
    const base = uniqueEmail('case');
    const plainPassword = 'secret12';
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: base.toLowerCase(),
        password: plainPassword,
        firstName: 'A',
        lastName: 'B',
        role: 'buyer',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: base.toUpperCase(),
        password: plainPassword,
      })
      .expect(200);
  });
});
