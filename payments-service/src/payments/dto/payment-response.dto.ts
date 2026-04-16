import { Payment, PaymentStatus } from '../entities/payment.entity';

export class PaymentResponseDto {
  id: string;
  orderId: string;
  userId: string;
  amount: number;
  status: PaymentStatus;
  paymentMethod: string;
  gatewayBillingId: string | null;
  paymentUrl: string | null;
  pixBrCode: string | null;
  pixBrCodeBase64: string | null;
  pixExpiresAt: string | null;
  rejectionReason: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;

  static fromEntity(p: Payment): PaymentResponseDto {
    const dto = new PaymentResponseDto();
    dto.id = p.id;
    dto.orderId = p.orderId;
    dto.userId = p.userId;
    dto.amount = Number.parseFloat(p.amount);
    dto.status = p.status;
    dto.paymentMethod = p.paymentMethod;
    dto.gatewayBillingId = p.gatewayBillingId;
    dto.paymentUrl = p.paymentUrl;
    dto.pixBrCode = p.pixBrCode;
    dto.pixBrCodeBase64 = p.pixBrCodeBase64;
    dto.pixExpiresAt = p.pixExpiresAt?.toISOString() ?? null;
    dto.rejectionReason = p.rejectionReason;
    dto.processedAt = p.processedAt?.toISOString() ?? null;
    dto.createdAt = p.createdAt.toISOString();
    dto.updatedAt = p.updatedAt.toISOString();
    return dto;
  }
}
