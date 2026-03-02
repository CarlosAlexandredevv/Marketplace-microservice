import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PaymentQueueService } from '../payment-queue/payment-queue.service';
import { PaymentOrderMessage } from '../payment-queue.interface';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';
import { validatePaymentOrderMessage } from './payment-message.validator';
import { MetricsService } from 'src/metrics/services/metrics.service';

@Injectable()
export class PaymentConsumerService implements OnModuleInit {
  private readonly logger = new Logger(PaymentConsumerService.name);

  constructor(
    private readonly paymentQueueService: PaymentQueueService,
    private readonly rabbitMQService: RabbitmqService,
    private readonly metricsService: MetricsService,
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

  private processPaymentOrder(message: PaymentOrderMessage): void {
    const startTime = Date.now();
    try {
      // Log inicial com informações da mensagem
      this.logger.log(
        `📝 Processing payment order: ` +
          `orderId=${message.orderId}, ` +
          `userId=${message.userId}, ` +
          `amount=${message.amount}`,
      );

      // Validar mensagem antes de processar
      if (!validatePaymentOrderMessage(message)) {
        this.logger.error('❌ Invalid payment message received');
        // Rejeitamos a mensagem para não ficar reprocessando
        throw new Error('Invalid payment message received');
      }

      // TODO: Processar pagamento usando PaymentsService
      // Isso será implementado na próxima aula
      this.logger.log('✅ Payment order received and validated');
      this.metricsService.updateMetrics(true, startTime);
    } catch (error) {
      this.metricsService.updateMetrics(false, startTime);
      // Log de erro com contexto completo
      this.logger.error(
        `❌ Failed to process payment for order ${message.orderId}:`,
        error,
      );

      // IMPORTANTE: Relançamos o erro para o RabbitMQ fazer NACK
      throw error;
    }
  }
}
