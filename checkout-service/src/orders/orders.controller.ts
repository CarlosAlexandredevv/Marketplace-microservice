import { Controller, Get, Param, ParseUUIDPipe, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import type { JwtUser } from '../auth/jwt.strategy';
import { OrderResponseDto } from './dto/order-response.dto';
import { OrdersService } from './orders.service';

type RequestWithUser = Request & { user: JwtUser };

@ApiTags('Orders')
@ApiBearerAuth('JWT-auth')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista pedidos do usuário autenticado (mais recentes primeiro)',
  })
  @ApiResponse({ status: 200, type: [OrderResponseDto] })
  async list(@Req() req: RequestWithUser): Promise<OrderResponseDto[]> {
    return this.ordersService.findAllForUser(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe de um pedido do próprio usuário' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'ID do pedido' })
  @ApiResponse({ status: 200, type: OrderResponseDto })
  @ApiResponse({
    status: 404,
    description: 'Pedido inexistente ou de outro usuário',
  })
  async getOne(
    @Req() req: RequestWithUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<OrderResponseDto> {
    return this.ordersService.findOneForUser(req.user.id, id);
  }
}
