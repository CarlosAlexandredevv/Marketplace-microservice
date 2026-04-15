import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { JwtUser } from '../auth/jwt.strategy';
import { Public } from '../auth/public.decorator';
import { SellerRoleGuard } from '../auth/seller-role.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
@ApiTags('Products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Lista o catálogo de produtos ativos' })
  findAllCatalog() {
    return this.productsService.findAllActiveCatalog();
  }

  @Public()
  @Get('seller/:sellerId')
  @ApiOperation({ summary: 'Lista produtos ativos por seller' })
  findBySeller(
    @Param('sellerId', new ParseUUIDPipe({ version: '4' })) sellerId: string,
  ) {
    return this.productsService.findActiveBySellerId(sellerId);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Busca um produto ativo por ID' })
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.productsService.findOneById(id);
  }

  @Post()
  @UseGuards(SellerRoleGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Cria produto (seller only)' })
  create(@Body() dto: CreateProductDto, @Req() req: { user: JwtUser }) {
    return this.productsService.create(dto, req.user.id);
  }
}
