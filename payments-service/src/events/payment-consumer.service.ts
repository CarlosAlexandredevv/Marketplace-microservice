import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { RabbitmqService } from './rabbitmq.service';
import type { PaymentOrderMessage } from './payment-order-message';
import { PaymentsService } from '../payments/payments.service';

const QUEUE = 'payment_queue';
const EXCHANGE = 'payments';
const ROUTING_KEY = 'payment.order';

@Injectable()
export class PaymentConsumerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PaymentConsumerService.name);

  constructor(
    private readonly rabbitmq: RabbitmqService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const channel = this.rabbitmq.getChannel();
    if (!channel) {
      this.logger.warn('Payment consumer not started (no RabbitMQ)');
      return;
    }
    try {
      await this.rabbitmq.subscribeToQueue(
        QUEUE,
        EXCHANGE,
        ROUTING_KEY,
        async (raw: unknown) => {
          const message = raw as PaymentOrderMessage;
          await this.paymentsService.processPaymentOrderMessage(message);
        },
      );
    } catch (error) {
      this.logger.error('Failed to subscribe payment consumer', error);
    }
  }
}
