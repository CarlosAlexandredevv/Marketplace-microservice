import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { PaymentsProxyController } from './payments-proxy.controller';
import { ProxyService } from '../proxy/service/proxy.service';

describe('PaymentsProxyController', () => {
  it('GET /payments/:orderId delega ao ProxyService com serviço payments', async () => {
    const proxyRequest = jest
      .fn()
      .mockResolvedValue({ id: 'pay-1', orderId: 'ord-1', status: 'approved' });
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsProxyController],
      providers: [{ provide: ProxyService, useValue: { proxyRequest } }],
    }).compile();

    const controller = module.get(PaymentsProxyController);
    const req = {
      headers: { authorization: 'Bearer token' },
      user: { userId: 'u1', email: 'a@b.com', role: 'buyer' },
    } as unknown as Request;

    const result = await controller.getPaymentByOrderId(
      '550e8400-e29b-41d4-a716-446655440000',
      req,
    );

    expect(result).toEqual({
      id: 'pay-1',
      orderId: 'ord-1',
      status: 'approved',
    });
    expect(proxyRequest).toHaveBeenCalledWith(
      'payments',
      'get',
      '/payments/550e8400-e29b-41d4-a716-446655440000',
      undefined,
      { Authorization: 'Bearer token' },
      { userId: 'u1', email: 'a@b.com', role: 'buyer' },
    );
  });
});
