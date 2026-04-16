import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../src/auth/public.decorator';

/**
 * Health check apenas do TypeORM (SQLite E2E), sem RabbitMQ.
 */
@Controller('health')
export class HealthE2eStubController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly typeOrm: TypeOrmHealthIndicator,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.typeOrm.pingCheck('postgres')]);
  }
}
