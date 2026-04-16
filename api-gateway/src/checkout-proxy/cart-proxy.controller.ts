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
  ApiOperation,
  ApiParam,
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
