import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbacatePayModule } from 'src/gateway/abacatepay/abacatepay.module';
import { Payment } from './entities/payment.entity';
import { HealthController } from './health.controller';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payment]), AbacatePayModule],
  controllers: [PaymentsController, HealthController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
