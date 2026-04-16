import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FakePaymentGatewayService } from '../gateway/fake-payment-gateway.service';
import type { PaymentOrderMessage } from '../events/payment-order-message';
import { RabbitmqService } from '../events/rabbitmq.service';
import { MetricsService } from '../metrics/metrics.service';
import {
  Payment,
  PaymentRecordStatus,
} from './entities/payment.entity';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  const paymentRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const fakeGateway = {
    decideStatus: jest.fn(),
  };
  const rabbitmq = {
    publishMessage: jest.fn(),
  };
  const metricsService = {
    incrementProcessedPayment: jest.fn(),
    incrementApprovedPayment: jest.fn(),
    incrementRejectedPayment: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getRepositoryToken(Payment),
          useValue: paymentRepository,
        },
        { provide: FakePaymentGatewayService, useValue: fakeGateway },
        { provide: RabbitmqService, useValue: rabbitmq },
        { provide: MetricsService, useValue: metricsService },
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  it('processPaymentOrderMessage ignora duplicata por orderId', async () => {
    paymentRepository.findOne.mockResolvedValue({ id: 'p1' } as Payment);

    await service.processPaymentOrderMessage({
      orderId: 'o1',
      userId: 'u1',
      amount: 10,
      items: [],
      paymentMethod: 'pix',
    });

    expect(fakeGateway.decideStatus).not.toHaveBeenCalled();
    expect(paymentRepository.save).not.toHaveBeenCalled();
  });

  it('processPaymentOrderMessage persiste aprovado e publica resultado', async () => {
    paymentRepository.findOne.mockResolvedValue(null);
    fakeGateway.decideStatus.mockReturnValue('approved');
    const saved = {
      id: 'pay1',
      orderId: 'o1',
      userId: 'u1',
      amount: '10.00',
      status: PaymentRecordStatus.APPROVED,
    } as Payment;
    paymentRepository.create.mockReturnValue(saved);
    paymentRepository.save.mockResolvedValue(saved);

    const message: PaymentOrderMessage = {
      orderId: 'o1',
      userId: 'u1',
      amount: 10,
      items: [{ productId: 'p', quantity: 1, price: 10 }],
      paymentMethod: 'pix',
    };

    await service.processPaymentOrderMessage(message);

    expect(paymentRepository.save).toHaveBeenCalled();
    expect(metricsService.incrementApprovedPayment).toHaveBeenCalled();
    expect(rabbitmq.publishMessage).toHaveBeenCalled();
  });

  it('getByOrderIdForUser retorna status mapeado', async () => {
    const payment = {
      id: 'pay1',
      orderId: 'o1',
      userId: 'u1',
      amount: '10.00',
      status: PaymentRecordStatus.APPROVED,
    } as Payment;
    paymentRepository.findOne.mockResolvedValue(payment);

    const result = await service.getByOrderIdForUser('o1', 'u1');

    expect(result).toEqual({
      id: 'pay1',
      orderId: 'o1',
      status: 'approved',
    });
  });

  it('getByOrderIdForUser lança NotFound quando usuário não é o titular', async () => {
    paymentRepository.findOne.mockResolvedValue({
      orderId: 'o1',
      userId: 'other',
    } as Payment);

    await expect(service.getByOrderIdForUser('o1', 'u1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
