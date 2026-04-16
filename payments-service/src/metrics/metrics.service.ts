import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from 'prom-client';
import { PaymentRejectionReason } from '../payments/entities/payment.entity';

type HttpMetricLabels = 'method' | 'route' | 'status_code';
type PaymentRejectionMetricLabels = 'reason';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;
  private readonly httpRequestsTotal: Counter<HttpMetricLabels>;
  private readonly httpRequestDurationSeconds: Histogram<HttpMetricLabels>;
  private readonly paymentsProcessedTotal: Counter<string>;
  private readonly paymentsApprovedTotal: Counter<string>;
  private readonly paymentsRejectedTotal: Counter<PaymentRejectionMetricLabels>;

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

    this.paymentsProcessedTotal = new Counter({
      name: 'payments_processed_total',
      help: 'Total de pagamentos processados',
      registers: [this.registry],
    });

    this.paymentsApprovedTotal = new Counter({
      name: 'payments_approved_total',
      help: 'Total de pagamentos aprovados',
      registers: [this.registry],
    });

    this.paymentsRejectedTotal = new Counter<PaymentRejectionMetricLabels>({
      name: 'payments_rejected_total',
      help: 'Total de pagamentos rejeitados por motivo',
      labelNames: ['reason'],
      registers: [this.registry],
    });
  }

  recordHttpRequest(labels: Record<HttpMetricLabels, string>, duration: number) {
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationSeconds.observe(labels, duration);
  }

  incrementProcessedPayment() {
    this.paymentsProcessedTotal.inc();
  }

  incrementApprovedPayment() {
    this.paymentsApprovedTotal.inc();
  }

  incrementRejectedPayment(reason: PaymentRejectionReason) {
    this.paymentsRejectedTotal.inc({ reason });
  }

  getMetrics() {
    return this.registry.metrics();
  }

  getContentType() {
    return this.registry.contentType;
  }
}
