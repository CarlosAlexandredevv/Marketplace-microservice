import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { AuthModule } from '../src/auth/auth.module';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { HealthModule } from '../src/health/health.module';
import { MetricsModule } from '../src/metrics/metrics.module';
import { User } from '../src/users/entities/user.entity';
import { UsersModule } from '../src/users/users.module';

/**
 * AppModule equivalente aos testes E2E com SQLite em memória (sem PostgreSQL).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [User],
      synchronize: true,
      logging: false,
    }),
    UsersModule,
    AuthModule,
    MetricsModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class E2eSqliteAppModule {}
