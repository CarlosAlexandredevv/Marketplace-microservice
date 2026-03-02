import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RabbitmqService } from './rabbitmq/rabbitmq.service';
import { PaymentQueueService } from './payment-queue/payment-queue.service';
import { PaymentConsumerService } from './payment-consumer/payment-consumer.service';
import { DlqService } from './dlq/dlq.service';
import { DlqController } from './dlq/dlq.controller';
import { MetricsModule } from 'src/events/metrics/metrics.module';

@Module({
  imports: [ConfigModule, MetricsModule],
  controllers: [DlqController],
  providers: [
    RabbitmqService,
    PaymentQueueService,
    PaymentConsumerService,
    DlqService,
  ],
  exports: [RabbitmqService],
})
export class EventsModule {}
