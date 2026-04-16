import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentConsumerService } from './payment-consumer.service';
import { RabbitmqService } from './rabbitmq.service';
import { PaymentsService } from '../payments/payments.service';

describe('PaymentConsumerService', () => {
  it('onApplicationBootstrap não inscreve fila quando canal RabbitMQ é undefined', async () => {
    const rabbitmq = {
      getChannel: jest.fn().mockReturnValue(undefined),
    };
    const paymentsService = {
      processPaymentOrderMessage: jest.fn(),
    };
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentConsumerService,
        { provide: RabbitmqService, useValue: rabbitmq },
        { provide: PaymentsService, useValue: paymentsService },
      ],
    }).compile();

    const consumer = module.get(PaymentConsumerService);
    await consumer.onApplicationBootstrap();

    expect(rabbitmq.getChannel).toHaveBeenCalled();
    expect(paymentsService.processPaymentOrderMessage).not.toHaveBeenCalled();
  });
});
