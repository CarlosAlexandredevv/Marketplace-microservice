import { Controller, Get, Res } from '@nestjs/common';
import { type Response } from 'express';
import {
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from 'src/auth/decorators/public.decorator';
import { MetricsService } from './metrics.service';

@ApiTags('Metrics')
@Controller()
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('metrics')
  @Public()
  @ApiOperation({ summary: 'Exporta métricas Prometheus do gateway' })
  @ApiProduces('text/plain')
  @ApiResponse({
    status: 200,
    description: 'Métricas no formato OpenMetrics/Prometheus',
    schema: {
      type: 'string',
      example:
        '# HELP http_requests_total Total HTTP requests\n# TYPE http_requests_total counter\nhttp_requests_total 42',
    },
  })
  async getMetrics(@Res() response: Response): Promise<void> {
    response.setHeader('Content-Type', this.metricsService.getContentType());
    response.send(await this.metricsService.getMetrics());
  }
}
