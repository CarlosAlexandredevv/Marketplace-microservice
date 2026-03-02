import { Module, forwardRef } from '@nestjs/common';
import { MetricsService } from './services/metrics.service';
import { MetricsController } from './metrics.controller';
import { EventsModule } from '../events.module';

@Module({
  imports: [forwardRef(() => EventsModule)],
  providers: [MetricsService],
  exports: [MetricsService],
  controllers: [MetricsController],
})
export class MetricsModule {}
