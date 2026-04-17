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
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
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
  @ApiBody({
    schema: {
      type: 'object',
      required: ['paymentMethod'],
      properties: {
        paymentMethod: {
          type: 'string',
          enum: ['credit_card', 'debit_card', 'pix', 'boleto'],
          example: 'pix',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Pedido criado com sucesso' })
  @ApiResponse({ status: 400, description: 'Carrinho vazio ou payload inválido' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
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
  @ApiResponse({ status: 200, description: 'Pedidos retornados com sucesso' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
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
  @ApiResponse({ status: 200, description: 'Pedido encontrado' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 404, description: 'Pedido não encontrado' })
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
