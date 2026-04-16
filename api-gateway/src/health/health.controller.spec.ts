import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
  HealthCheckService as TerminusHealthCheckService,
  HttpHealthIndicator,
} from '@nestjs/terminus';
import { HealthCheckService } from 'src/common/health/health-check.service';
import { HealthStatus } from 'src/common/health/health-check.interface';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  const terminusHealth = {
    check: jest.fn().mockResolvedValue({
      status: 'ok',
      info: {},
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
    checkAllServices: jest.fn(),
    getCachedHealth: jest.fn(),
  };
  const configService = {
    get: jest.fn().mockReturnValue(5000),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: TerminusHealthCheckService, useValue: terminusHealth },
        { provide: HttpHealthIndicator, useValue: http },
        { provide: HealthCheckService, useValue: healthCheckService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('getHealth delega ao Terminus com indicadores HTTP', async () => {
    await controller.getHealth();

    expect(terminusHealth.check).toHaveBeenCalled();
  });

  it('getServicesHealth agrega status dos serviços', async () => {
    const services = [
      {
        name: 'users',
        url: 'http://localhost:3000',
        status: HealthStatus.HEALTHY,
        responseTime: 2,
        lastCheck: new Date(),
      },
    ];
    healthCheckService.checkAllServices.mockResolvedValue(services);

    const result = await controller.getServicesHealth();

    expect(result.overallStatus).toBe('healthy');
    expect(result.services).toEqual(services);
    expect(result.summary.total).toBe(1);
  });

  it('getServiceHealth retorna unknown quando não há cache', () => {
    healthCheckService.getCachedHealth.mockReturnValue(undefined);

    const result = controller.getServiceHealth('users');

    expect(result.status).toBe('unknown');
  });
});
