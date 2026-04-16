import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '../entities/order.entity';

export class OrderResponseDto {
  @ApiProperty({ format: 'uuid' })
  orderId: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ format: 'uuid' })
  cartId: string;

  @ApiProperty({
    description:
      'Total do pedido (duas casas decimais, alinhado ao total do carrinho)',
    example: '31.00',
  })
  total: string;

  @ApiProperty({ enum: OrderStatus })
  status: OrderStatus;

  @ApiProperty({
    description: 'Método de pagamento escolhido no checkout',
    example: 'pix',
  })
  paymentMethod: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
