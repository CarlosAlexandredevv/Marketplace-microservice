import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RabbitmqService } from './rabbitmq/rabbitmq.service';
import { PaymentQueueService } from './payment-queue/payment-queue.service';
import { PaymentConsumerService } from './payment-consumer/payment-consumer.service';
import { DlqService } from './dlq/dlq.service';
import { DlqController } from './dlq/dlq.controller';
import { MetricsModule } from 'src/events/metrics/metrics.module';
import { PaymentsModule } from 'src/payments/payments.module';

@Module({
  imports: [ConfigModule, forwardRef(() => MetricsModule), PaymentsModule],
  controllers: [DlqController],
  providers: [
    RabbitmqService,
    PaymentQueueService,
    PaymentConsumerService,
    DlqService,
  ],
  exports: [RabbitmqService, PaymentConsumerService, PaymentQueueService],
})
export class EventsModule {}
