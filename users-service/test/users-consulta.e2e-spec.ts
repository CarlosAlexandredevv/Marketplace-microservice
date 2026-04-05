import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User, UserStatus } from '../src/users/entities/user.entity';
import { createAppValidationPipe } from '../src/validation-pipe.config';

type PublicUserBody = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

async function registerAndLogin(
  app: INestApplication<App>,
  opts: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: 'seller' | 'buyer';
  },
): Promise<{ token: string; user: PublicUserBody }> {
  const registerRes = await request(app.getHttpServer())
    .post('/auth/register')
    .send({
      email: opts.email,
      password: opts.password,
      firstName: opts.firstName,
      lastName: opts.lastName,
      role: opts.role,
    })
    .expect(201);

  const loginRes = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email: opts.email, password: opts.password })
    .expect(200);

  const token = (loginRes.body as { token: string }).token;
  const user = registerRes.body as PublicUserBody;
  return { token, user };
}

describe('Users consulta (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    expect(process.env.JWT_SECRET?.trim()).toBeDefined();
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

  it('GET /users/profile — 401 sem Authorization', async () => {
    await request(app.getHttpServer()).get('/users/profile').expect(401);
  });

  it('GET /users/profile — 401 com token malformado', async () => {
    await request(app.getHttpServer())
      .get('/users/profile')
      .set('Authorization', 'Bearer not-a-jwt')
      .expect(401);
  });

  it('GET /users/profile — 200, sem password, dados alinhados ao registo e atualizados na BD', async () => {
    const plainPassword = 'secret12';
    const email = `e2e.profile.${randomUUID()}@example.com`;
    const { token, user: registered } = await registerAndLogin(app, {
      email,
      password: plainPassword,
      firstName: 'Perfil',
      lastName: 'Teste',
      role: 'buyer',
    });

    const res1 = await request(app.getHttpServer())
      .get('/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const body1 = res1.body as PublicUserBody & { password?: string };
    expect(body1.password).toBeUndefined();
    expect(body1.id).toBe(registered.id);
    expect(body1.email).toBe(registered.email);
    expect(body1.firstName).toBe(registered.firstName);
    expect(body1.lastName).toBe(registered.lastName);
    expect(body1.role).toBe(registered.role);
    expect(body1.status).toBe(registered.status);

    await dataSource.getRepository(User).update(registered.id, {
      firstName: 'Atualizado',
    });

    const res2 = await request(app.getHttpServer())
      .get('/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const body2 = res2.body as PublicUserBody;
    expect(body2.firstName).toBe('Atualizado');
  });

  it('GET /users/sellers — 401 sem Authorization', async () => {
    await request(app.getHttpServer()).get('/users/sellers').expect(401);
  });

  it('GET /users/sellers — 401 com token malformado', async () => {
    await request(app.getHttpServer())
      .get('/users/sellers')
      .set('Authorization', 'Bearer not-a-jwt')
      .expect(401);
  });

  it('GET /users/sellers — 200, só sellers ativos, sem password', async () => {
    const plainPassword = 'secret12';
    const tokenSellerA = (
      await registerAndLogin(app, {
        email: `e2e.sellers.a.${randomUUID()}@example.com`,
        password: plainPassword,
        firstName: 'Seller',
        lastName: 'Ativo',
        role: 'seller',
      })
    ).token;

    const inactiveSeller = await registerAndLogin(app, {
      email: `e2e.sellers.inactive.${randomUUID()}@example.com`,
      password: plainPassword,
      firstName: 'Seller',
      lastName: 'Inativo',
      role: 'seller',
    });
    await dataSource.getRepository(User).update(inactiveSeller.user.id, {
      status: UserStatus.INACTIVE,
    });

    await registerAndLogin(app, {
      email: `e2e.sellers.buyer.${randomUUID()}@example.com`,
      password: plainPassword,
      firstName: 'Comprador',
      lastName: 'Só',
      role: 'buyer',
    });

    const res = await request(app.getHttpServer())
      .get('/users/sellers')
      .set('Authorization', `Bearer ${tokenSellerA}`)
      .expect(200);

    const list = res.body as (PublicUserBody & { password?: string })[];
    expect(Array.isArray(list)).toBe(true);
    for (const item of list) {
      expect(item.password).toBeUndefined();
      expect(item.role).toBe('seller');
      expect(item.status).toBe('active');
    }
    const ids = list.map((u) => u.id);
    const profileRes = await request(app.getHttpServer())
      .get('/users/profile')
      .set('Authorization', `Bearer ${tokenSellerA}`)
      .expect(200);
    const profileBody = profileRes.body as PublicUserBody;
    expect(ids).toContain(profileBody.id);
    expect(ids).not.toContain(inactiveSeller.user.id);
  });

  it('GET /users/:id — 401 sem Authorization', async () => {
    await request(app.getHttpServer())
      .get(`/users/${randomUUID()}`)
      .expect(401);
  });

  it('GET /users/:id — 401 com token malformado', async () => {
    await request(app.getHttpServer())
      .get(`/users/${randomUUID()}`)
      .set('Authorization', 'Bearer not-a-jwt')
      .expect(401);
  });

  it('GET /users/:id — 200 com id existente, sem password', async () => {
    const plainPassword = 'secret12';
    const { token, user: target } = await registerAndLogin(app, {
      email: `e2e.byid.${randomUUID()}@example.com`,
      password: plainPassword,
      firstName: 'Alvo',
      lastName: 'User',
      role: 'buyer',
    });

    const res = await request(app.getHttpServer())
      .get(`/users/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const body = res.body as PublicUserBody & { password?: string };
    expect(body.password).toBeUndefined();
    expect(body.id).toBe(target.id);
    expect(body.email).toBe(target.email);
  });

  it('GET /users/:id — 404 com UUID inexistente', async () => {
    const plainPassword = 'secret12';
    const { token } = await registerAndLogin(app, {
      email: `e2e.404.${randomUUID()}@example.com`,
      password: plainPassword,
      firstName: 'X',
      lastName: 'Y',
      role: 'buyer',
    });

    await request(app.getHttpServer())
      .get(`/users/${randomUUID()}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('GET /users/profile e GET /users/sellers não são capturados por GET /users/:id', async () => {
    const plainPassword = 'secret12';
    const { token } = await registerAndLogin(app, {
      email: `e2e.routes.${randomUUID()}@example.com`,
      password: plainPassword,
      firstName: 'Rotas',
      lastName: 'Estáticas',
      role: 'seller',
    });

    await request(app.getHttpServer())
      .get('/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/users/sellers')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
