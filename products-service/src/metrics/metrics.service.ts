import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from 'prom-client';

type HttpMetricLabels = 'method' | 'route' | 'status_code';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;
  private readonly httpRequestsTotal: Counter<HttpMetricLabels>;
  private readonly httpRequestDurationSeconds: Histogram<HttpMetricLabels>;

  constructor() {
    this.registry = new Registry();

    collectDefaultMetrics({
      register: this.registry,
    });

    this.httpRequestsTotal = new Counter<HttpMetricLabels>({
      name: 'http_requests_total',
      help: 'Total de requisicoes HTTP processadas',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestDurationSeconds = new Histogram<HttpMetricLabels>({
      name: 'http_request_duration_seconds',
      help: 'Duracao das requisicoes HTTP em segundos',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.3, 0.5, 1, 2, 5, 10],
    });
  }

  recordHttpRequest(labels: Record<HttpMetricLabels, string>, duration: number) {
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationSeconds.observe(labels, duration);
  }

  getMetrics() {
    return this.registry.metrics();
  }

  getContentType() {
    return this.registry.contentType;
  }
}
