import {
  HttpCode,
  HttpStatus,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ProxyService } from 'src/proxy/service/proxy.service';

@ApiTags('Products')
@Controller('products')
export class ProductsProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Get()
  @ApiOperation({ summary: 'Lista catálogo de produtos (proxy)' })
  @ApiResponse({ status: 200, description: 'Lista de produtos retornada' })
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
  @ApiParam({ name: 'sellerId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Lista de produtos do seller retornada' })
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
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Produto encontrado' })
  @ApiResponse({ status: 404, description: 'Produto não encontrado' })
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
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Cria produto (proxy)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'description', 'price', 'stock'],
      properties: {
        name: { type: 'string', maxLength: 255, example: 'Notebook Gamer' },
        description: { type: 'string', example: 'Notebook com 16GB RAM e SSD' },
        price: { type: 'number', example: 5299.9, minimum: 0.01 },
        stock: { type: 'integer', example: 10, minimum: 0 },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Produto criado com sucesso' })
  @ApiResponse({ status: 400, description: 'Payload inválido' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
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
