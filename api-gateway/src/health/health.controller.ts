import { Controller, Get, Param } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheck,
  HealthCheckService as TerminusHealthCheckService,
  HttpHealthIndicator,
} from '@nestjs/terminus';
import { HealthCheckService } from 'src/common/health/health-check.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthStatus } from 'src/common/health/health-check.interface';
import { serviceConfig } from 'src/config/gateway.config';

@Controller('health')
export class HealthController {
  constructor(
    private readonly terminusHealth: TerminusHealthCheckService,
    private readonly http: HttpHealthIndicator,
    private readonly healthCheckService: HealthCheckService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check agregado (downstreams via Terminus)' })
  @ApiResponse({ status: 200, description: 'Gateway e serviços downstream saudáveis' })
  @ApiResponse({ status: 503, description: 'Um ou mais downstreams indisponíveis' })
  @HealthCheck()
  getHealth() {
    const timeoutMs = this.configService.get<number>(
      'HEALTH_CHECK_TIMEOUT_MS',
      10000,
    );
    return this.terminusHealth.check([
      () =>
        this.http.pingCheck('users', `${serviceConfig.users.url}/health`, {
          timeout: timeoutMs,
        }),
      () =>
        this.http.pingCheck('products', `${serviceConfig.products.url}/health`, {
          timeout: timeoutMs,
        }),
      () =>
        this.http.pingCheck('checkout', `${serviceConfig.checkout.url}/health`, {
          timeout: timeoutMs,
        }),
      () =>
        this.http.pingCheck('payments', `${serviceConfig.payments.url}/health`, {
          timeout: timeoutMs,
        }),
    ]);
  }

  @Get('services')
  @ApiOperation({ summary: 'Health check de todos os serviços' })
  @ApiResponse({ status: 200, description: 'Status de todos os serviços' })
  async getServicesHealth() {
    const services = await this.healthCheckService.checkAllServices();

    const overallStatus = services.every(
      (s) => s.status === HealthStatus.HEALTHY,
    )
      ? 'healthy'
      : services.some((s) => s.status === HealthStatus.DEGRADED)
        ? 'degraded'
        : 'unhealthy';

    return {
      overallStatus,
      timestamp: new Date().toISOString(),
      services,
      summary: {
        total: services.length,
        healthy: services.filter((s) => s.status === HealthStatus.HEALTHY)
          .length,
        unhealthy: services.filter((s) => s.status === HealthStatus.UNHEALTHY)
          .length,
        degraded: services.filter((s) => s.status === HealthStatus.DEGRADED)
          .length,
      },
    };
  }

  @Get('services/:serviceName')
  @ApiOperation({ summary: 'Health check de um serviço específico' })
  @ApiResponse({ status: 200, description: 'Status do serviço' })
  getServiceHealth(@Param('serviceName') serviceName: string) {
    const cached = this.healthCheckService.getCachedHealth(serviceName);

    if (!cached) {
      return {
        status: 'unknown',
        message: 'Service not found or never checked',
        timestamp: new Date().toISOString(),
      };
    }

    return cached;
  }
}
