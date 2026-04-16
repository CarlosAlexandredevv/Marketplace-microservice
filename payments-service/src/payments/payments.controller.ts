import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { AbacatePayConfigService } from 'src/gateway/abacatepay/abacatepay-config.service';
import { AbacatePayWebhookPayload } from 'src/gateway/abacatepay/dto/abacatepay-webhook.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { PaymentsService } from './payments.service';
import {
  verifyAbacateWebhookSignature,
  verifyWebhookQuerySecret,
} from './webhook-signature.util';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly abacateConfig: AbacatePayConfigService,
  ) {}

  @Get(':orderId')
  async findOne(
    @Param('orderId') orderId: string,
  ): Promise<PaymentResponseDto> {
    const p = await this.paymentsService.findByOrderId(orderId);
    return PaymentResponseDto.fromEntity(p);
  }

  @Post('webhook/abacatepay')
  @HttpCode(200)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Query('webhookSecret') webhookSecret?: string,
    @Headers('x-webhook-signature') signature?: string,
  ): Promise<{ received: boolean }> {
    const raw =
      req.rawBody instanceof Buffer
        ? req.rawBody.toString('utf8')
        : typeof req.rawBody === 'string'
          ? req.rawBody
          : '';
    if (!raw) {
      throw new UnauthorizedException();
    }
    const secret = this.abacateConfig.webhookSecret;
    const okQuery = verifyWebhookQuerySecret(webhookSecret, secret);
    const okSig = verifyAbacateWebhookSignature(raw, signature, secret);
    if (!okQuery && !okSig) {
      throw new UnauthorizedException();
    }
    let payload: AbacatePayWebhookPayload;
    try {
      payload = JSON.parse(raw) as AbacatePayWebhookPayload;
    } catch {
      throw new UnauthorizedException();
    }
    await this.paymentsService.handleWebhook(payload);
    return { received: true };
  }
}
