import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/public.decorator';
import { AppService } from './app.service';
import { PaymentQueueService } from './events/payment-queue/payment-queue.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly paymentQueueService: PaymentQueueService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('health')
  health(): { status: string; service: string } {
    return { status: 'ok', service: 'checkout-service' };
  }
}
