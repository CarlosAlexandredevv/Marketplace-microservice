import { FakePaymentGatewayService } from './fake-payment-gateway.service';

describe('FakePaymentGatewayService', () => {
  const gateway = new FakePaymentGatewayService();

  it('aprova totais cujo centavo não é 99', () => {
    expect(gateway.decideStatus(100)).toBe('approved');
    expect(gateway.decideStatus(10.5)).toBe('approved');
  });

  it('rejeita totais com parte decimal .99 (regra E2E produto .99)', () => {
    expect(gateway.decideStatus(99.99)).toBe('rejected');
    expect(gateway.decideStatus(1.99)).toBe('rejected');
  });
});
