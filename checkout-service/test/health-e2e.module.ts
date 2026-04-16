import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthE2eStubController } from './health-e2e-stub.controller';

@Module({
  imports: [TerminusModule],
  controllers: [HealthE2eStubController],
})
export class HealthE2eModule {}
