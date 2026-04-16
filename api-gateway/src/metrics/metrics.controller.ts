import { Controller, Get, Res } from '@nestjs/common';
import { type Response } from 'express';
import { Public } from 'src/auth/decorators/public.decorator';
import { MetricsService } from './metrics.service';

@Controller()
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('metrics')
  @Public()
  async getMetrics(@Res() response: Response): Promise<void> {
    response.setHeader('Content-Type', this.metricsService.getContentType());
    response.send(await this.metricsService.getMetrics());
  }
}
