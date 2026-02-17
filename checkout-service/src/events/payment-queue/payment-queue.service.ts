import { Injectable, Logger } from '@nestjs/common';
import type { RabbitmqService } from '../rabbitmq/rabbitmq.service';
import type { PaymentOrderMessage } from '../payment-queue.interface';
import { validatePaymentOrder } from './payment-order.validator';

@Injectable()
export class PaymentQueueService {
  private readonly logger = new Logger(PaymentQueueService.name);
  private readonly ROUTING_KEY = 'payment.order';
  private readonly EXCHANGE = 'payments';

  constructor(private readonly rabbitMQService: RabbitmqService) {}

  async publishPaymentOrder(paymentOrder: PaymentOrderMessage): Promise<void> {
    this.logger.log(
      `📤 Publishing payment order for orderId: ${paymentOrder.orderId}`,
    );

    try {
      const enrichmentMessage: PaymentOrderMessage = {
        ...paymentOrder,
        createdAt: paymentOrder.createdAt || new Date(),
        metadata: {
          service: 'checkout-service',
          timestamp: new Date().toISOString(),
        },
      };

      await this.rabbitMQService.publishMessage(
        this.EXCHANGE, // Para onde enviar
        this.ROUTING_KEY, // Como rotear
        enrichmentMessage, // O que enviar
      );

      this.logger.log(
        `✅ Payment order published successfully: ` +
          `orderId=${paymentOrder.orderId}` +
          `amount=${paymentOrder.amount}` +
          `userId=${paymentOrder.userId}`,
      );

      this.logger.debug(
        `Payment order details: ${JSON.stringify(enrichmentMessage)}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to publish payment order: orderId=${paymentOrder.orderId}`,
        error,
      );

      throw error;
    }
  }

  async publishPaymentOrderSafe(
    paymentOrder: PaymentOrderMessage,
  ): Promise<void> {
    const result = validatePaymentOrder(paymentOrder);

    if (!result.valid) {
      result.errors.forEach((error) =>
        this.logger.error(`❌ Invalid payment order: ${error}`),
      );
      throw new Error('Invalid payment order');
    }

    await this.publishPaymentOrder(paymentOrder);
  }
}
