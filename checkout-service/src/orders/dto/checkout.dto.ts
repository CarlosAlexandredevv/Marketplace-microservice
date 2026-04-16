import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum CheckoutPaymentMethod {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  PIX = 'pix',
  BOLETO = 'boleto',
}

export class CheckoutDto {
  @ApiProperty({
    enum: CheckoutPaymentMethod,
    enumName: 'CheckoutPaymentMethod',
    example: CheckoutPaymentMethod.PIX,
  })
  @IsEnum(CheckoutPaymentMethod)
  paymentMethod: CheckoutPaymentMethod;
}
