import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CartModule } from '../cart/cart.module';
import { EventsModule } from '../events/events.module';
import { CartCheckoutController } from './cart-checkout.controller';
import { Order } from './entities/order.entity';
import { OrdersController } from './orders.controller';
import { PaymentResultConsumerService } from './payment-result-consumer.service';
import { OrdersService } from './orders.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order]), CartModule, EventsModule],
  controllers: [OrdersController, CartCheckoutController],
  providers: [OrdersService, PaymentResultConsumerService],
})
export class OrdersModule {}
