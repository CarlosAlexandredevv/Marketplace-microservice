import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FakePaymentGatewayService } from '../gateway/fake-payment-gateway.service';
import type { PaymentOrderMessage } from '../events/payment-order-message';
import type { PaymentResultMessage } from '../events/payment-result-message';
import { RabbitmqService } from '../events/rabbitmq.service';
import { MetricsService } from '../metrics/metrics.service';
import {
  Payment,
  PaymentRecordStatus,
  PaymentRejectionReason,
} from './entities/payment.entity';

const PAYMENTS_EXCHANGE = 'payments';
const PAYMENT_RESULT_ROUTING_KEY = 'payment.result';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly fakeGateway: FakePaymentGatewayService,
    private readonly rabbitmq: RabbitmqService,
    private readonly metricsService: MetricsService,
  ) {}

  async processPaymentOrderMessage(
    message: PaymentOrderMessage,
  ): Promise<void> {
    const existing = await this.paymentRepository.findOne({
      where: { orderId: message.orderId },
    });
    if (existing) {
      return;
    }

    const decision = this.fakeGateway.decideStatus(message.amount);
    const status =
      decision === 'approved'
        ? PaymentRecordStatus.APPROVED
        : PaymentRecordStatus.REJECTED;

    const payment = this.paymentRepository.create({
      orderId: message.orderId,
      userId: message.userId,
      amount: message.amount.toFixed(2),
      status,
    });
    await this.paymentRepository.save(payment);
    this.metricsService.incrementProcessedPayment();

    if (status === PaymentRecordStatus.APPROVED) {
      this.metricsService.incrementApprovedPayment();
    } else {
      this.metricsService.incrementRejectedPayment(
        PaymentRejectionReason.INSUFFICIENT_FUNDS,
      );
    }

    const result: PaymentResultMessage = {
      orderId: message.orderId,
      userId: message.userId,
      status: decision,
    };
    await this.rabbitmq.publishMessage(
      PAYMENTS_EXCHANGE,
      PAYMENT_RESULT_ROUTING_KEY,
      result,
    );
  }

  async getByOrderIdForUser(
    orderId: string,
    userId: string,
  ): Promise<{
    id: string;
    orderId: string;
    status: 'approved' | 'rejected';
  }> {
    const payment = await this.paymentRepository.findOne({
      where: { orderId },
    });
    if (!payment || payment.userId !== userId) {
      throw new NotFoundException('Pagamento não encontrado');
    }
    return {
      id: payment.id,
      orderId: payment.orderId,
      status:
        payment.status === PaymentRecordStatus.APPROVED
          ? 'approved'
          : 'rejected',
    };
  }
}
