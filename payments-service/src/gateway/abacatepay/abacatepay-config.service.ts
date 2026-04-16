import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AbacatePayConfigService implements OnModuleInit {
  private readonly logger = new Logger(AbacatePayConfigService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const required = [
      'ABACATEPAY_API_KEY',
      'ABACATEPAY_BASE_URL',
      'ABACATEPAY_RETURN_URL',
      'ABACATEPAY_COMPLETION_URL',
      'ABACATEPAY_WEBHOOK_SECRET',
    ] as const;
    const missing = required.filter((k) => !this.config.get<string>(k)?.trim());
    if (missing.length > 0) {
      this.logger.warn(
        `Variáveis AbacatePay ausentes (serviço pode falhar): ${missing.join(', ')}`,
      );
    }
  }

  get apiKey(): string {
    return this.config.get<string>('ABACATEPAY_API_KEY', '');
  }

  get baseUrl(): string {
    return this.config
      .get<string>('ABACATEPAY_BASE_URL', '')
      .replace(/\/$/, '');
  }

  get returnUrl(): string {
    return this.config.get<string>('ABACATEPAY_RETURN_URL', '');
  }

  get completionUrl(): string {
    return this.config.get<string>('ABACATEPAY_COMPLETION_URL', '');
  }

  get webhookSecret(): string {
    return this.config.get<string>('ABACATEPAY_WEBHOOK_SECRET', '');
  }

  get devMode(): boolean {
    return this.config.get<string>('ABACATEPAY_DEV_MODE', 'false') === 'true';
  }

  get pixExpiresIn(): number {
    const raw = this.config.get<string>('ABACATEPAY_PIX_EXPIRES_IN', '3600');
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 3600;
  }
}
