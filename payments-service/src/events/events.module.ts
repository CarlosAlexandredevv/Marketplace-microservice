import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RabbitmqService } from './rabbitmq/rabbitmq.service';
import { PaymentQueueService } from './payment-queue/payment-queue.service';
import { PaymentConsumerService } from './payment-consumer/payment-consumer.service';
import { DlqService } from './dlq/dlq.service';
import { DlqController } from './dlq/dlq.controller';
import { MetricsModule } from 'src/events/metrics/metrics.module';
import { MetricsController } from './metrics/metrics.controller';

@Module({
  imports: [ConfigModule, MetricsModule],
  controllers: [DlqController, MetricsController],
  providers: [
    RabbitmqService,
    PaymentQueueService,
    PaymentConsumerService,
    DlqService,
  ],
  exports: [RabbitmqService],
})
export class EventsModule {}
