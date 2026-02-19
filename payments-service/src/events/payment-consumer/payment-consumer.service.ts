import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PaymentQueueService } from '../payment-queue/payment-queue.service';
import { PaymentOrderMessage } from '../payment-queue.interface';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';
import { validatePaymentOrderMessage } from './payment-message.validator';

@Injectable()
export class PaymentConsumerService implements OnModuleInit {
  private readonly logger = new Logger(PaymentConsumerService.name);

  constructor(
    private readonly paymentQueueService: PaymentQueueService,
    private readonly rabbitMQService: RabbitmqService,
  ) {}

  async onModuleInit() {
    this.logger.log('🚀 Starting Payment Consumer Service');
    await this.startConsuming();
  }

  async startConsuming() {
    try {
      this.logger.log('👂 Starting to consume payment orders from queue');

      // Registra callback para processar cada mensagem
      // O bind(this) garante que o 'this' dentro do callback seja esta classe
      await this.paymentQueueService.consumePaymentOrders(
        this.processPaymentOrder.bind(this),
      );

      this.logger.log('✅ Payment Consumer Service started successfully');
    } catch (error) {
      this.logger.error('❌ Failed to start consuming payment orders:', error);
    }
  }

  private processPaymentOrder(message: PaymentOrderMessage): void {
    try {
      this.logger.log(
        `📝 Processing payment order: ` +
          `orderId=${message.orderId}, ` +
          `userId=${message.userId}, ` +
          `amount=${message.amount}`,
      );

      const validation = validatePaymentOrderMessage(message);
      if (!validation.valid) {
        this.logger.error(`❌ Invalid payment message: ${validation.error}`);
        return;
      }

      // TODO: Processar pagamento usando PaymentsService
      // Isso será implementado na próxima aula
      this.logger.log('✅ Payment order received and validated');
    } catch (error) {
      this.logger.error(
        `❌ Failed to process payment for order ${message.orderId}:`,
        error,
      );

      throw error;
    }
  }
}
