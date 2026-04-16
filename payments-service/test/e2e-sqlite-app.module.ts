import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../src/auth/auth.module';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { HealthE2eModule } from './health-e2e.module';
import { MetricsModule } from '../src/metrics/metrics.module';
import { Payment } from '../src/payments/entities/payment.entity';
import { PaymentsModule } from '../src/payments/payments.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [Payment],
      synchronize: true,
      logging: false,
    }),
    AuthModule,
    PaymentsModule,
    MetricsModule,
    HealthE2eModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class E2eSqliteAppModule {}
