import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FakePaymentGatewayService } from '../gateway/fake-payment-gateway.service';
import { RabbitmqService } from '../events/rabbitmq.service';
import { PaymentConsumerService } from '../events/payment-consumer.service';
import { Payment } from './entities/payment.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payment])],
  controllers: [PaymentsController],
  providers: [
    RabbitmqService,
    FakePaymentGatewayService,
    PaymentsService,
    PaymentConsumerService,
  ],
})
export class PaymentsModule {}
