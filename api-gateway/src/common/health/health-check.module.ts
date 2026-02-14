import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { HealthCheckService } from './health-check.service';
import { CircuitBreakerModule } from '../circuit-breaker/circuit-breaker.module';

@Module({
  imports: [HttpModule, CircuitBreakerModule],
  providers: [HealthCheckService],
  exports: [HealthCheckService],
})
export class HealthCheckModule {}
