import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentOrderMessage } from 'src/events/payment-queue.interface';
import { AbacatePayGatewayService } from 'src/gateway/abacatepay/abacatepay-gateway.service';
import { GatewayAuthException } from 'src/gateway/exceptions/gateway-auth.exception';
import { GatewayUnavailableException } from 'src/gateway/exceptions/gateway-unavailable.exception';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let repo: jest.Mocked<
    Pick<Repository<Payment>, 'findOne' | 'create' | 'save' | 'query'>
  >;
  let gateway: jest.Mocked<
    Pick<
      AbacatePayGatewayService,
      'isPixMethod' | 'createPixCharge' | 'createBilling' | 'healthPing'
    >
  >;

  const baseMessage: PaymentOrderMessage = {
    orderId: '550e8400-e29b-41d4-a716-446655440000',
    userId: '650e8400-e29b-41d4-a716-446655440000',
    amount: 100,
    items: [{ productId: 'p1', quantity: 1, price: 100 }],
    paymentMethod: 'CARD',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getRepositoryToken(Payment),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn((x: Partial<Payment>) => x as Payment),
            save: jest.fn((x: Payment) => Promise.resolve(x)),
            query: jest.fn(),
          },
        },
        {
          provide: AbacatePayGatewayService,
          useValue: {
            isPixMethod: jest.fn(),
            createPixCharge: jest.fn(),
            createBilling: jest.fn(),
            healthPing: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(PaymentsService);
    repo = module.get(getRepositoryToken(Payment));
    gateway = module.get(AbacatePayGatewayService);
  });

  it('retorna existente quando pending e já há gatewayBillingId', async () => {
    const existing: Payment = {
      id: 'pay-1',
      orderId: baseMessage.orderId,
      userId: baseMessage.userId,
      amount: '100.00',
      status: PaymentStatus.PENDING,
      paymentMethod: 'CARD',
      gatewayBillingId: 'bill_1',
      paymentUrl: 'https://pay.example',
      pixBrCode: null,
      pixBrCodeBase64: null,
      pixExpiresAt: null,
      rejectionReason: null,
      processedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    repo.findOne.mockResolvedValue(existing);

    const result = await service.processPayment(baseMessage);

    expect(result).toBe(existing);
    expect(gateway.createBilling).not.toHaveBeenCalled();
  });

  it('propaga GatewayUnavailableException', async () => {
    repo.findOne.mockResolvedValue(null);
    gateway.isPixMethod.mockReturnValue(false);
    gateway.createBilling.mockRejectedValue(new GatewayUnavailableException());

    await expect(service.processPayment(baseMessage)).rejects.toBeInstanceOf(
      GatewayUnavailableException,
    );
  });

  it('marca rejected e não propaga em GatewayAuthException', async () => {
    repo.findOne.mockResolvedValue(null);
    gateway.isPixMethod.mockReturnValue(false);
    gateway.createBilling.mockRejectedValue(new GatewayAuthException('401'));

    const saved: Payment[] = [];
    repo.save.mockImplementation((p) => {
      saved.push(p as Payment);
      return Promise.resolve(p as Payment);
    });

    const result = await service.processPayment(baseMessage);

    expect(result.status).toBe(PaymentStatus.REJECTED);
    expect(result.rejectionReason).toBeDefined();
  });

  it('handleWebhook: PAID aprova pagamento', async () => {
    const payment: Payment = {
      id: 'pay-1',
      orderId: baseMessage.orderId,
      userId: baseMessage.userId,
      amount: '100.00',
      status: PaymentStatus.PENDING,
      paymentMethod: 'CARD',
      gatewayBillingId: 'bill_x',
      paymentUrl: 'https://x',
      pixBrCode: null,
      pixBrCodeBase64: null,
      pixExpiresAt: null,
      rejectionReason: null,
      processedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    repo.findOne.mockResolvedValue(payment);

    await service.handleWebhook({
      data: { id: 'bill_x', status: 'PAID' },
    });

    expect(repo.save).toHaveBeenCalled();
    const firstSave = jest.mocked(repo.save).mock.calls[0];
    expect(firstSave).toBeDefined();
    const arg = firstSave[0] as Payment;
    expect(arg.status).toBe(PaymentStatus.APPROVED);
    expect(arg.processedAt).toBeDefined();
  });
});
