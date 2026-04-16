import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { firstValueFrom } from 'rxjs';
import { PaymentOrderMessage } from 'src/events/payment-queue.interface';
import { GatewayAuthException } from '../exceptions/gateway-auth.exception';
import { GatewayBusinessException } from '../exceptions/gateway-business.exception';
import { GatewayRequestException } from '../exceptions/gateway-request.exception';
import { GatewayUnavailableException } from '../exceptions/gateway-unavailable.exception';
import { AbacatePayConfigService } from './abacatepay-config.service';
import {
  AbacatePayApiEnvelope,
  AbacatePayBillingData,
  AbacatePayPixData,
} from './dto/abacatepay-api-response.dto';

const TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;

export interface PixChargeResult {
  gatewayBillingId: string;
  pixBrCode: string;
  pixBrCodeBase64: string;
  pixExpiresAt: Date;
}

export interface CardBillingResult {
  gatewayBillingId: string;
  paymentUrl: string;
}

@Injectable()
export class AbacatePayGatewayService {
  private readonly logger = new Logger(AbacatePayGatewayService.name);

  constructor(
    private readonly http: HttpService,
    private readonly abacateConfig: AbacatePayConfigService,
  ) {}

  private v1(path: string): string {
    return `${this.abacateConfig.baseUrl}/v1${path}`;
  }

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.abacateConfig.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private parseEnvelope<T>(body: AbacatePayApiEnvelope<T>): T {
    if (body.error != null && body.error !== '') {
      throw new GatewayBusinessException(String(body.error));
    }
    if (body.data == null) {
      throw new GatewayBusinessException('Resposta sem data');
    }
    return body.data;
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((r) => setTimeout(r, ms));
  }

  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        return await fn();
      } catch (e) {
        lastErr = e;
        if (
          e instanceof GatewayUnavailableException &&
          attempt < MAX_ATTEMPTS - 1
        ) {
          const backoff = Math.pow(2, attempt) * 200;
          await this.sleep(backoff);
          continue;
        }
        throw e instanceof Error ? e : new Error(String(e));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  private handleAxiosError(err: unknown): never {
    if (axios.isAxiosError(err)) {
      const ax = err as AxiosError;
      const status = ax.response?.status;
      const body = ax.response?.data;

      if (status === 401) {
        throw new GatewayAuthException(
          typeof body === 'object' && body && 'error' in body
            ? String((body as { error: unknown }).error)
            : 'HTTP 401',
        );
      }
      if (status != null && status >= 400 && status < 500) {
        throw new GatewayRequestException(`HTTP ${status}`, body);
      }
      if (status != null && status >= 500) {
        throw new GatewayUnavailableException(`HTTP ${status}`);
      }
      if (ax.code === 'ECONNABORTED' || ax.code === 'ETIMEDOUT') {
        throw new GatewayUnavailableException('Timeout');
      }
      if (!ax.response) {
        throw new GatewayUnavailableException(ax.message || 'Network error');
      }
    }
    throw err instanceof Error ? err : new Error(String(err));
  }

  private async requestJson<T>(config: AxiosRequestConfig): Promise<T> {
    return this.executeWithRetry(async () => {
      try {
        const res = await firstValueFrom(
          this.http.request<AbacatePayApiEnvelope<T>>({
            ...config,
            timeout: TIMEOUT_MS,
            validateStatus: () => true,
            headers: {
              ...this.authHeaders(),
              ...config.headers,
            },
          }),
        );
        const status = res.status;
        const body = res.data;

        if (status === 401) {
          throw new GatewayAuthException(
            body?.error != null ? String(body.error) : 'HTTP 401',
          );
        }
        if (status >= 400 && status < 500) {
          throw new GatewayRequestException(`HTTP ${status}`, body);
        }
        if (status >= 500) {
          throw new GatewayUnavailableException(`HTTP ${status}`);
        }

        return this.parseEnvelope(body);
      } catch (e) {
        if (
          e instanceof GatewayAuthException ||
          e instanceof GatewayRequestException ||
          e instanceof GatewayBusinessException ||
          e instanceof GatewayUnavailableException
        ) {
          throw e;
        }
        this.handleAxiosError(e);
      }
    });
  }

  isPixMethod(paymentMethod: string): boolean {
    return paymentMethod.trim().toUpperCase() === 'PIX';
  }

  mapBillingMethods(paymentMethod: string): string[] {
    const m = paymentMethod.trim().toUpperCase();
    if (m === 'PIX') {
      return ['PIX'];
    }
    if (m === 'CARD' || m === 'CREDIT_CARD' || m === 'CREDITCARD') {
      return ['CARD'];
    }
    return ['CARD'];
  }

  buildProducts(message: PaymentOrderMessage): {
    externalId: string;
    name: string;
    description?: string;
    quantity: number;
    price: number;
  }[] {
    const expectedTotalCents = Math.round(message.amount * 100);
    let sumCents = 0;

    const products = message.items.map((item) => {
      const externalId = item.id ?? item.productId ?? '';
      const name = item.name?.trim?.() ?? `Produto ${externalId}`;
      const unitCents = Math.max(100, Math.round(item.price * 100));
      const line = unitCents * item.quantity;
      sumCents += line;
      const p: {
        externalId: string;
        name: string;
        description?: string;
        quantity: number;
        price: number;
      } = {
        externalId: externalId,
        name: name,
        quantity: item.quantity,
        price: unitCents,
      };
      if (item.description?.trim()) {
        p.description = item.description.trim();
      }
      return p;
    });

    if (sumCents !== expectedTotalCents) {
      this.logger.warn(
        `Soma dos itens (${sumCents} centavos) difere do amount do pedido (${expectedTotalCents} centavos) orderId=${message.orderId}`,
      );
    }

    return products;
  }

  async createPixCharge(
    message: PaymentOrderMessage,
    amountReais: number,
  ): Promise<PixChargeResult> {
    const amountCents = Math.round(amountReais * 100);
    const desc = `Pedido #${message.orderId}`.slice(0, 37);

    const data = await this.requestJson<AbacatePayPixData>({
      method: 'POST',
      url: this.v1('/pixQrCode/create'),
      data: {
        amount: amountCents,
        expiresIn: this.abacateConfig.pixExpiresIn,
        description: desc,
        metadata: {
          orderId: message.orderId,
          userId: message.userId,
        },
      },
    });

    if (data.status !== 'PENDING') {
      this.logger.warn(`PIX criado com status inesperado: ${data.status}`);
    }

    return {
      gatewayBillingId: data.id,
      pixBrCode: data.brCode ?? '',
      pixBrCodeBase64: data.brCodeBase64 ?? '',
      pixExpiresAt: data.expiresAt ? new Date(data.expiresAt) : new Date(),
    };
  }

  async createBilling(
    message: PaymentOrderMessage,
  ): Promise<CardBillingResult> {
    const products = this.buildProducts(message);

    const data = await this.requestJson<AbacatePayBillingData>({
      method: 'POST',
      url: this.v1('/billing/create'),
      data: {
        frequency: 'ONE_TIME',
        methods: this.mapBillingMethods(message.paymentMethod),
        products,
        returnUrl: this.abacateConfig.returnUrl,
        completionUrl: this.abacateConfig.completionUrl,
        externalId: message.orderId,
        metadata: {
          orderId: message.orderId,
          userId: message.userId,
        },
      },
    });

    if (data.status !== 'PENDING') {
      this.logger.warn(`Billing criado com status inesperado: ${data.status}`);
    }

    return {
      gatewayBillingId: data.id,
      paymentUrl: data.url,
    };
  }

  async simulatePixPayment(pixQrCodeId: string): Promise<void> {
    if (!this.abacateConfig.devMode) {
      throw new Error(
        'simulatePixPayment só é permitido com ABACATEPAY_DEV_MODE=true',
      );
    }
    await this.requestJson<AbacatePayPixData>({
      method: 'POST',
      url: `${this.v1('/pixQrCode/simulate-payment')}?id=${encodeURIComponent(pixQrCodeId)}`,
      data: { metadata: {} },
    });
  }

  async healthPing(): Promise<void> {
    await this.requestJson<Record<string, unknown>>({
      method: 'GET',
      url: this.v1('/public-mrr/merchant-info'),
    });
  }
}
