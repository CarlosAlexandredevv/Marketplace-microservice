import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guards/auth.guard';
import { ProxyService } from 'src/proxy/service/proxy.service';

@ApiTags('Orders')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class OrdersProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Post('cart/checkout')
  @ApiOperation({ summary: 'Finaliza carrinho e cria pedido (proxy)' })
  checkout(@Body() payload: unknown, @Req() req: Request) {
    const auth = req.headers.authorization;
    return this.proxyService.proxyRequest(
      'checkout',
      'post',
      '/cart/checkout',
      payload,
      auth ? { Authorization: auth } : {},
    );
  }

  @Get('orders')
  @ApiOperation({ summary: 'Lista pedidos do usuário (proxy)' })
  list(@Req() req: Request) {
    const auth = req.headers.authorization;
    return this.proxyService.proxyRequest(
      'checkout',
      'get',
      '/orders',
      undefined,
      auth ? { Authorization: auth } : {},
    );
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Detalha pedido por ID (proxy)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  getOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request,
  ) {
    const auth = req.headers.authorization;
    return this.proxyService.proxyRequest(
      'checkout',
      'get',
      `/orders/${id}`,
      undefined,
      auth ? { Authorization: auth } : {},
    );
  }
}
