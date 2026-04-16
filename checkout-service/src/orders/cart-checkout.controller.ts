import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import type { JwtUser } from '../auth/jwt.strategy';
import { CheckoutDto } from './dto/checkout.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { OrdersService } from './orders.service';

type RequestWithUser = Request & { user: JwtUser };

@ApiTags('Cart')
@ApiBearerAuth('JWT-auth')
@Controller('cart')
export class CartCheckoutController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('checkout')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Finaliza o carrinho ativo e cria pedido (publica fila de pagamento)',
  })
  @ApiResponse({ status: 201, type: OrderResponseDto })
  @ApiResponse({
    status: 400,
    description: 'paymentMethod inválido ou ausente',
  })
  @ApiResponse({
    status: 422,
    description: 'Carrinho ativo inexistente ou sem itens',
  })
  @ApiResponse({
    status: 503,
    description: 'Fila de pagamento indisponível após persistir o pedido',
  })
  async checkout(
    @Req() req: RequestWithUser,
    @Body() dto: CheckoutDto,
  ): Promise<OrderResponseDto> {
    return this.ordersService.checkout(req.user.id, dto);
  }
}
