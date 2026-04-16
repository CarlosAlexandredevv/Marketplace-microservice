import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from 'prom-client';

type HttpMetricLabels = 'method' | 'route' | 'status_code';
type QueueMetricLabels = 'queue';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;
  private readonly httpRequestsTotal: Counter<HttpMetricLabels>;
  private readonly httpRequestDurationSeconds: Histogram<HttpMetricLabels>;
  private readonly ordersCreatedTotal: Counter<string>;
  private readonly rabbitmqMessagesPublishedTotal: Counter<QueueMetricLabels>;

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

    this.ordersCreatedTotal = new Counter({
      name: 'orders_created_total',
      help: 'Total de pedidos criados com sucesso',
      registers: [this.registry],
    });

    this.rabbitmqMessagesPublishedTotal = new Counter<QueueMetricLabels>({
      name: 'rabbitmq_messages_published_total',
      help: 'Total de mensagens publicadas no RabbitMQ por fila logica',
      labelNames: ['queue'],
      registers: [this.registry],
    });
  }

  recordHttpRequest(
    labels: Record<HttpMetricLabels, string>,
    duration: number,
  ) {
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationSeconds.observe(labels, duration);
  }

  incrementOrdersCreated() {
    this.ordersCreatedTotal.inc();
  }

  incrementPublishedMessage(queue: string) {
    this.rabbitmqMessagesPublishedTotal.inc({ queue });
  }

  getMetrics() {
    return this.registry.metrics();
  }

  getContentType() {
    return this.registry.contentType;
  }
}
