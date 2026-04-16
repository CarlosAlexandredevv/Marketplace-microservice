import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PaymentQueueService } from '../payment-queue/payment-queue.service';
import { PaymentOrderMessage } from '../payment-queue.interface';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';
import { validatePaymentOrderMessage } from './payment-message.validator';
import { MetricsService } from 'src/events/metrics/services/metrics.service';
import { GatewayUnavailableException } from 'src/gateway/exceptions/gateway-unavailable.exception';
import { PaymentsService } from 'src/payments/payments.service';

@Injectable()
export class PaymentConsumerService implements OnModuleInit {
  private readonly logger = new Logger(PaymentConsumerService.name);

  constructor(
    private readonly paymentQueueService: PaymentQueueService,
    private readonly rabbitMQService: RabbitmqService,
    private readonly metricsService: MetricsService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async onModuleInit() {
    this.logger.log('🚀 Starting Payment Consumer Service');
    this.metricsService.metrics.startedAt = new Date();
    await this.startConsuming();
  }

  async startConsuming() {
    try {
      this.logger.log('👂 Starting to consume payment orders from queue');

      const isConnected = await this.rabbitMQService.waitForConnection();

      if (!isConnected) {
        this.logger.error(
          '❌ Could not connect to RabbitMQ after multiple attempts',
        );
        return;
      }

      // Registra callback para processar cada mensagem
      // O bind(this) garante que o 'this' dentro do callback seja esta classe
      await this.paymentQueueService.consumePaymentOrders(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        this.processPaymentOrder.bind(this),
      );

      this.logger.log('✅ Payment Consumer Service started successfully');
    } catch (error) {
      this.logger.error('❌ Failed to start consuming payment orders:', error);
    }
  }

  private async processPaymentOrder(
    message: PaymentOrderMessage,
  ): Promise<void> {
    const startTime = Date.now();
    try {
      // Log inicial com informações da mensagem
      this.logger.log(
        `📝 Processing payment order: ` +
          `orderId=${message.orderId}, ` +
          `userId=${message.userId}, ` +
          `amount=${message.amount}`,
      );

      const validation = validatePaymentOrderMessage(message);
      if (!validation.valid) {
        this.logger.error(
          `❌ Invalid payment message received: ${validation.error ?? 'unknown'}`,
        );
        throw new Error('Invalid payment message received');
      }

      await this.paymentsService.processPayment(message);
      this.logger.log('✅ Payment order processed');
      this.metricsService.updateMetrics(true, startTime);
    } catch (error) {
      this.metricsService.updateMetrics(false, startTime);
      if (error instanceof GatewayUnavailableException) {
        this.logger.warn(
          `Gateway indisponível para orderId=${message.orderId}; mensagem será retentada`,
        );
        throw error;
      }
      this.logger.error(
        `❌ Failed to process payment for order ${message.orderId}:`,
        error,
      );
      throw error;
    }
  }
}
