import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { AuthModule } from '../src/auth/auth.module';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { CartModule } from '../src/cart/cart.module';
import { CartItem } from '../src/cart/entities/cart-item.entity';
import { Cart } from '../src/cart/entities/cart.entity';
import { EventsModule } from '../src/events/events.module';
import { HealthE2eModule } from './health-e2e.module';
import { MetricsModule } from '../src/metrics/metrics.module';
import { Order } from '../src/orders/entities/order.entity';
import { OrdersModule } from '../src/orders/orders.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [Cart, CartItem, Order],
      synchronize: true,
      logging: false,
    }),
    AuthModule,
    CartModule,
    OrdersModule,
    EventsModule,
    MetricsModule,
    HealthE2eModule,
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
