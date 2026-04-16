import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentOrderMessage } from 'src/events/payment-queue.interface';
import { AbacatePayGatewayService } from 'src/gateway/abacatepay/abacatepay-gateway.service';
import { AbacatePayWebhookPayload } from 'src/gateway/abacatepay/dto/abacatepay-webhook.dto';
import { GatewayAuthException } from 'src/gateway/exceptions/gateway-auth.exception';
import { GatewayBusinessException } from 'src/gateway/exceptions/gateway-business.exception';
import { GatewayRequestException } from 'src/gateway/exceptions/gateway-request.exception';
import { GatewayUnavailableException } from 'src/gateway/exceptions/gateway-unavailable.exception';
import { Payment, PaymentStatus } from './entities/payment.entity';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly abacateGateway: AbacatePayGatewayService,
  ) {}

  async processPayment(message: PaymentOrderMessage): Promise<Payment> {
    let payment = await this.paymentRepo.findOne({
      where: { orderId: message.orderId },
    });

    if (payment) {
      if (
        payment.status === PaymentStatus.APPROVED ||
        payment.status === PaymentStatus.REJECTED
      ) {
        if (payment.status === PaymentStatus.REJECTED) {
          this.logger.warn(
            `Pedido ${message.orderId} já rejeitado; não reprocessando`,
          );
        }
        return payment;
      }
      if (
        payment.status === PaymentStatus.PENDING &&
        payment.gatewayBillingId
      ) {
        return payment;
      }
    }

    if (!payment) {
      payment = this.paymentRepo.create({
        orderId: message.orderId,
        userId: message.userId,
        amount: message.amount.toFixed(2),
        status: PaymentStatus.PENDING,
        paymentMethod: message.paymentMethod,
        gatewayBillingId: null,
        paymentUrl: null,
        pixBrCode: null,
        pixBrCodeBase64: null,
        pixExpiresAt: null,
        rejectionReason: null,
        processedAt: null,
      });
      await this.paymentRepo.save(payment);
    }

    try {
      if (this.abacateGateway.isPixMethod(message.paymentMethod)) {
        const pix = await this.abacateGateway.createPixCharge(
          message,
          message.amount,
        );
        payment.gatewayBillingId = pix.gatewayBillingId;
        payment.pixBrCode = pix.pixBrCode;
        payment.pixBrCodeBase64 = pix.pixBrCodeBase64;
        payment.pixExpiresAt = pix.pixExpiresAt;
        payment.paymentUrl = null;
      } else {
        const bill = await this.abacateGateway.createBilling(message);
        payment.gatewayBillingId = bill.gatewayBillingId;
        payment.paymentUrl = bill.paymentUrl;
        payment.pixBrCode = null;
        payment.pixBrCodeBase64 = null;
        payment.pixExpiresAt = null;
      }
      await this.paymentRepo.save(payment);
      return payment;
    } catch (e) {
      if (e instanceof GatewayUnavailableException) {
        throw e;
      }
      if (
        e instanceof GatewayAuthException ||
        e instanceof GatewayRequestException ||
        e instanceof GatewayBusinessException
      ) {
        const reason =
          e instanceof GatewayRequestException
            ? JSON.stringify(e.body ?? e.message)
            : e.message;
        payment.status = PaymentStatus.REJECTED;
        payment.rejectionReason = reason.slice(0, 255);
        payment.processedAt = new Date();
        await this.paymentRepo.save(payment);
        return payment;
      }
      throw e;
    }
  }

  async handleWebhook(payload: AbacatePayWebhookPayload): Promise<void> {
    const gatewayBillingId = payload.data?.id;
    if (!gatewayBillingId) {
      this.logger.warn('Webhook sem data.id');
      return;
    }

    const payment = await this.paymentRepo.findOne({
      where: { gatewayBillingId },
    });
    if (!payment) {
      this.logger.warn(
        `Nenhum pagamento local para gatewayBillingId=${gatewayBillingId}`,
      );
      return;
    }

    const raw = payload.data.status?.toUpperCase() ?? '';

    if (
      payment.status === PaymentStatus.APPROVED ||
      payment.status === PaymentStatus.REJECTED
    ) {
      return;
    }

    const now = new Date();

    if (raw === 'PAID') {
      payment.status = PaymentStatus.APPROVED;
      payment.processedAt = now;
      payment.rejectionReason = null;
    } else if (raw === 'EXPIRED') {
      payment.status = PaymentStatus.REJECTED;
      payment.rejectionReason = 'Cobrança expirada';
      payment.processedAt = now;
    } else if (raw === 'CANCELLED') {
      payment.status = PaymentStatus.REJECTED;
      payment.rejectionReason = 'Cobrança cancelada';
      payment.processedAt = now;
    } else {
      this.logger.debug(`Webhook status ignorado: ${raw}`);
      return;
    }

    await this.paymentRepo.save(payment);
  }

  async findByOrderId(orderId: string): Promise<Payment> {
    const p = await this.paymentRepo.findOne({ where: { orderId } });
    if (!p) {
      throw new NotFoundException(
        `Pagamento não encontrado para orderId=${orderId}`,
      );
    }
    return p;
  }

  async pingDatabase(): Promise<void> {
    await this.paymentRepo.query('SELECT 1');
  }
}
