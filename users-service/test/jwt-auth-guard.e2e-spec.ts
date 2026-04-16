import { Controller, Get, INestApplication, Req } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import type { Request } from 'express';
import request from 'supertest';
import { App } from 'supertest/types';
import { E2eSqliteAppModule } from './e2e-sqlite-app.module';
import { createAppValidationPipe } from '../src/validation-pipe.config';

@Controller('e2e')
class E2EJwtProbeController {
  @Get('jwt-probe')
  jwtProbe(@Req() req: Request) {
    return req.user;
  }
}

describe('JWT auth guard (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  beforeAll(async () => {
    expect(process.env.JWT_SECRET?.trim()).toBeDefined();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [E2eSqliteAppModule],
      controllers: [E2EJwtProbeController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(createAppValidationPipe());
    await app.init();
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /e2e/jwt-probe — 401 sem Authorization', async () => {
    await request(app.getHttpServer()).get('/e2e/jwt-probe').expect(401);
  });

  it('GET /e2e/jwt-probe — 401 com token malformado', async () => {
    await request(app.getHttpServer())
      .get('/e2e/jwt-probe')
      .set('Authorization', 'Bearer not-a-jwt')
      .expect(401);
  });

  it('GET /e2e/jwt-probe — 401 com assinatura inválida (secret diferente)', async () => {
    const token = await jwtService.signAsync(
      {
        sub: randomUUID(),
        email: 'wrong-sig@example.com',
        role: 'buyer',
      },
      { secret: 'wrong-secret-for-signature-test-min-32-chars!!' },
    );
    await request(app.getHttpServer())
      .get('/e2e/jwt-probe')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('GET /e2e/jwt-probe — 401 com token expirado', async () => {
    const token = await jwtService.signAsync(
      {
        sub: randomUUID(),
        email: 'expired@example.com',
        role: 'buyer',
      },
      { expiresIn: '-120s' },
    );
    await request(app.getHttpServer())
      .get('/e2e/jwt-probe')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('GET /e2e/jwt-probe — 200 e req.user com JWT válido do login', async () => {
    const plainPassword = 'secret12';
    const email = `e2e.jwt.${randomUUID()}@example.com`;
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: plainPassword,
        firstName: 'Test',
        lastName: 'User',
        role: 'seller',
      })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: plainPassword })
      .expect(200);

    const token = (loginRes.body as { token: string }).token;
    const registered = registerRes.body as {
      id: string;
      email: string;
      role: string;
    };

    const probeRes = await request(app.getHttpServer())
      .get('/e2e/jwt-probe')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const user = probeRes.body as {
      id: string;
      email: string;
      role: string;
    };
    expect(user.id).toBe(registered.id);
    expect(user.email).toBe(registered.email);
    expect(user.role).toBe(registered.role);
  });
});
