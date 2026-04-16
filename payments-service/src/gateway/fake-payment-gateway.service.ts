import { Injectable } from '@nestjs/common';

/**
 * Simula gateway externo: totais cujo valor decimal termina em .99 são rejeitados
 * (ex.: 99.99), alinhado à spec E2E do marketplace.
 */
@Injectable()
export class FakePaymentGatewayService {
  decideStatus(amount: number): 'approved' | 'rejected' {
    const cents = Math.round(amount * 100) % 100;
    return cents === 99 ? 'rejected' : 'approved';
  }
}
