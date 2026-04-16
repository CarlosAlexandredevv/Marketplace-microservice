import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
  HealthCheckService as TerminusHealthCheckService,
  HttpHealthIndicator,
} from '@nestjs/terminus';
import request from 'supertest';
import { App } from 'supertest/types';
import { HealthCheckService } from '../src/common/health/health-check.service';
import { HealthStatus } from '../src/common/health/health-check.interface';
import { HealthModule } from '../src/health/health.module';

describe('HealthController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const terminusHealth = {
      check: jest.fn().mockResolvedValue({
        status: 'ok',
        info: {
          users: { status: 'up' },
          products: { status: 'up' },
          checkout: { status: 'up' },
          payments: { status: 'up' },
        },
      }),
    };
    const http = {
      pingCheck: jest
        .fn()
        .mockImplementation((key: string) =>
          Promise.resolve({ [key]: { status: 'up' } }),
        ),
    };
    const healthCheckService = {
      checkAllServices: jest.fn().mockResolvedValue([
        {
          name: 'users',
          url: 'http://localhost:3000',
          status: HealthStatus.HEALTHY,
          responseTime: 1,
          lastCheck: new Date(),
        },
        {
          name: 'products',
          url: 'http://localhost:3001',
          status: HealthStatus.HEALTHY,
          responseTime: 1,
          lastCheck: new Date(),
        },
        {
          name: 'checkout',
          url: 'http://localhost:3003',
          status: HealthStatus.HEALTHY,
          responseTime: 1,
          lastCheck: new Date(),
        },
        {
          name: 'payments',
          url: 'http://localhost:3004',
          status: HealthStatus.HEALTHY,
          responseTime: 1,
          lastCheck: new Date(),
        },
      ]),
      getCachedHealth: jest.fn().mockReturnValue(undefined),
    };
    const configService = {
      get: jest.fn().mockImplementation((key: string, def?: number) => {
        if (key === 'HEALTH_CHECK_TIMEOUT_MS') return def ?? 10000;
        return def;
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), HealthModule],
    })
      .overrideProvider(TerminusHealthCheckService)
      .useValue(terminusHealth)
      .overrideProvider(HttpHealthIndicator)
      .useValue(http)
      .overrideProvider(HealthCheckService)
      .useValue(healthCheckService)
      .overrideProvider(ConfigService)
      .useValue(configService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health — 200 com downstreams mockados', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(res.body.status).toBe('ok');
  });

  it('GET /health/services — 200 com resumo agregado', async () => {
    const res = await request(app.getHttpServer())
      .get('/health/services')
      .expect(200);

    expect(res.body.overallStatus).toBe('healthy');
    expect(res.body.services).toHaveLength(4);
  });
});
