import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { PaymentResultMessage } from '../events/payment-result.interface';
import { RabbitmqService } from '../events/rabbitmq/rabbitmq.service';
import { Order, OrderStatus } from './entities/order.entity';

const QUEUE = 'checkout_payment_result_queue';
const EXCHANGE = 'payments';
const ROUTING_KEY = 'payment.result';

@Injectable()
export class PaymentResultConsumerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PaymentResultConsumerService.name);

  constructor(
    private readonly rabbitmq: RabbitmqService,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      if (!this.rabbitmq.getChannel()) {
        this.logger.warn(
          'Consumidor de resultado de pagamento desativado (RabbitMQ indisponível)',
        );
        return;
      }
      await this.rabbitmq.subscribeToQueue(
        QUEUE,
        EXCHANGE,
        ROUTING_KEY,
        async (raw: unknown) => {
          await this.applyPaymentResult(raw as PaymentResultMessage);
        },
      );
    } catch (error) {
      this.logger.warn(
        `Consumidor de resultado de pagamento não iniciado: ${(error as Error).message}`,
      );
    }
  }

  private async applyPaymentResult(
    message: PaymentResultMessage,
  ): Promise<void> {
    if (
      !message?.orderId ||
      !message?.userId ||
      (message.status !== 'approved' && message.status !== 'rejected')
    ) {
      this.logger.warn('Mensagem de resultado de pagamento inválida ignorada');
      return;
    }

    const order = await this.orderRepository.findOne({
      where: { orderId: message.orderId, userId: message.userId },
    });
    if (!order) {
      this.logger.warn(
        `Pedido não encontrado para resultado de pagamento: ${message.orderId}`,
      );
      return;
    }

    const nextStatus: OrderStatus =
      message.status === 'approved' ? OrderStatus.PAID : OrderStatus.FAILED;

    if (order.status === nextStatus) {
      return;
    }

    order.status = nextStatus;
    await this.orderRepository.save(order);
    this.logger.log(
      `Pedido ${message.orderId} atualizado para status ${nextStatus}`,
    );
  }
}
