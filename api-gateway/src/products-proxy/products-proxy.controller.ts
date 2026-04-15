import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProxyService } from 'src/proxy/service/proxy.service';

@ApiTags('Products')
@Controller('products')
export class ProductsProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Get()
  @ApiOperation({ summary: 'Lista catálogo de produtos (proxy)' })
  async findAll(@Req() req: Request) {
    const auth = req.headers.authorization;
    return this.proxyService.proxyRequest(
      'products',
      'get',
      '/products',
      undefined,
      auth ? { Authorization: auth } : {},
    );
  }

  @Get('seller/:sellerId')
  @ApiOperation({ summary: 'Lista produtos por seller (proxy)' })
  async findBySeller(@Param('sellerId') sellerId: string, @Req() req: Request) {
    const auth = req.headers.authorization;
    return this.proxyService.proxyRequest(
      'products',
      'get',
      `/products/seller/${sellerId}`,
      undefined,
      auth ? { Authorization: auth } : {},
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca produto por ID (proxy)' })
  async findById(@Param('id') id: string, @Req() req: Request) {
    const auth = req.headers.authorization;
    return this.proxyService.proxyRequest(
      'products',
      'get',
      `/products/${id}`,
      undefined,
      auth ? { Authorization: auth } : {},
    );
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Cria produto (proxy)' })
  async create(
    @Body() payload: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const auth = req.headers.authorization;
    const response: unknown = await this.proxyService.proxyRequest(
      'products',
      'post',
      '/products',
      payload,
      auth ? { Authorization: auth } : {},
    );
    res.status(HttpStatus.CREATED);
    return response;
  }
}
