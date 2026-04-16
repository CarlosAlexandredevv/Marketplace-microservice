import { ApiProperty } from '@nestjs/swagger';

export class CartItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  productId: string;

  @ApiProperty()
  productName: string;

  @ApiProperty({ example: '19.99' })
  price: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty({ example: '39.98' })
  subtotal: string;

  @ApiProperty()
  createdAt: Date;
}
