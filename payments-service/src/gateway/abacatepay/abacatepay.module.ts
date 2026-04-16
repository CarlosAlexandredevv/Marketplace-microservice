import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AbacatePayConfigService } from './abacatepay-config.service';
import { AbacatePayGatewayService } from './abacatepay-gateway.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10_000,
      maxRedirects: 0,
    }),
  ],
  providers: [AbacatePayConfigService, AbacatePayGatewayService],
  exports: [AbacatePayConfigService, AbacatePayGatewayService],
})
export class AbacatePayModule {}
