import { ApiProperty } from '@nestjs/swagger';
import { CartStatus } from '../entities/cart.entity';
import { CartItemResponseDto } from './cart-item-response.dto';

export class CartResponseDto {
  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description: 'Ausente até o primeiro item ser adicionado',
  })
  id: string | null;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ enum: CartStatus })
  status: CartStatus;

  @ApiProperty({ example: '0.00' })
  total: string;

  @ApiProperty({ type: [CartItemResponseDto] })
  items: CartItemResponseDto[];

  @ApiProperty({ required: false })
  createdAt?: Date;

  @ApiProperty({ required: false })
  updatedAt?: Date;
}
