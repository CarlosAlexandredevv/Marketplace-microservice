import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import type { JwtUser } from '../auth/jwt.strategy';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { CartResponseDto } from './dto/cart-response.dto';

type RequestWithUser = Request & { user: JwtUser };

@ApiTags('Cart')
@ApiBearerAuth('JWT-auth')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({
    summary: 'Carrinho ativo do usuário (vazio se ainda não existir)',
  })
  @ApiResponse({ status: 200, type: CartResponseDto })
  async getCart(@Req() req: RequestWithUser): Promise<CartResponseDto> {
    return this.cartService.getActiveCartForUser(req.user.id);
  }

  @Post('items')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Adiciona itens ao carrinho (mesmo produto soma quantidade)',
  })
  @ApiResponse({ status: 201, type: CartResponseDto })
  @ApiResponse({
    status: 422,
    description: 'Produto inativo ou preço inválido',
  })
  @ApiResponse({
    status: 404,
    description: 'Produto não encontrado no catálogo',
  })
  async addItem(
    @Req() req: RequestWithUser,
    @Body() dto: AddCartItemDto,
  ): Promise<CartResponseDto> {
    return this.cartService.addItem(req.user.id, dto);
  }

  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Remove um item do carrinho ativo' })
  @ApiParam({ name: 'itemId', format: 'uuid' })
  @ApiResponse({ status: 200, type: CartResponseDto })
  @ApiResponse({ status: 404, description: 'Item não encontrado' })
  async removeItem(
    @Req() req: RequestWithUser,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
  ): Promise<CartResponseDto> {
    return this.cartService.removeItem(req.user.id, itemId);
  }
}
