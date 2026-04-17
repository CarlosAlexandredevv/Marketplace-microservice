import {
  Body,
  Controller,
  Delete,
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

@ApiTags('Cart')
@Controller('cart')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class CartProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Post('items')
  @ApiOperation({ summary: 'Adiciona item ao carrinho (proxy)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['productId', 'quantity'],
      properties: {
        productId: {
          type: 'string',
          format: 'uuid',
          example: '550e8400-e29b-41d4-a716-446655440000',
        },
        quantity: { type: 'integer', minimum: 1, example: 2 },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Item adicionado ao carrinho' })
  @ApiResponse({ status: 400, description: 'Payload inválido' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  addItem(@Body() payload: unknown, @Req() req: Request) {
    const auth = req.headers.authorization;
    return this.proxyService.proxyRequest(
      'checkout',
      'post',
      '/cart/items',
      payload,
      auth ? { Authorization: auth } : {},
    );
  }

  @Get()
  @ApiOperation({ summary: 'Consulta carrinho ativo (proxy)' })
  @ApiResponse({ status: 200, description: 'Carrinho ativo retornado' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  getCart(@Req() req: Request) {
    const auth = req.headers.authorization;
    return this.proxyService.proxyRequest(
      'checkout',
      'get',
      '/cart',
      undefined,
      auth ? { Authorization: auth } : {},
    );
  }

  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Remove item do carrinho (proxy)' })
  @ApiParam({ name: 'itemId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Carrinho atualizado após remoção do item' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({ status: 404, description: 'Item do carrinho não encontrado' })
  removeItem(
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Req() req: Request,
  ) {
    const auth = req.headers.authorization;
    return this.proxyService.proxyRequest(
      'checkout',
      'delete',
      `/cart/items/${itemId}`,
      undefined,
      auth ? { Authorization: auth } : {},
    );
  }
}
