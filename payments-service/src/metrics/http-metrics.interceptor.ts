import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { type Request } from 'express';
import { finalize, type Observable } from 'rxjs';
import { MetricsService } from './metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<{ statusCode: number }>();
    const start = process.hrtime.bigint();

    return next.handle().pipe(
      finalize(() => {
        const method = request.method ?? 'UNKNOWN';
        const route = this.resolveRoute(request);

        if (route === '/metrics') {
          return;
        }

        const statusCode = String(response.statusCode ?? 500);
        const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;

        this.metricsService.recordHttpRequest(
          {
            method,
            route,
            status_code: statusCode,
          },
          durationSeconds,
        );
      }),
    );
  }

  private resolveRoute(request: Request): string {
    const requestRoute = request.route as { path?: string } | undefined;
    const routePath =
      requestRoute?.path ?? request.path ?? request.originalUrl?.split('?')[0];

    if (!routePath) {
      return 'unknown_route';
    }

    return routePath.startsWith('/') ? routePath : `/${routePath}`;
  }
}
