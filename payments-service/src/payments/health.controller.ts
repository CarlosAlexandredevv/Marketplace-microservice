import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { AbacatePayGatewayService } from 'src/gateway/abacatepay/abacatepay-gateway.service';
import { PaymentsService } from './payments.service';

@Controller()
export class HealthController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly abacateGateway: AbacatePayGatewayService,
  ) {}

  @Get('health')
  async health(): Promise<{
    status: string;
    database: string;
    gateway: string;
  }> {
    let databaseOk = false;
    let gatewayOk = false;
    try {
      await this.paymentsService.pingDatabase();
      databaseOk = true;
    } catch {
      databaseOk = false;
    }
    try {
      await this.abacateGateway.healthPing();
      gatewayOk = true;
    } catch {
      gatewayOk = false;
    }
    if (databaseOk && gatewayOk) {
      return {
        status: 'ok',
        database: 'ok',
        gateway: 'ok',
      };
    }
    throw new ServiceUnavailableException({
      status: 'error',
      database: databaseOk ? 'ok' : 'error',
      gateway: gatewayOk ? 'ok' : 'error',
    });
  }
}
