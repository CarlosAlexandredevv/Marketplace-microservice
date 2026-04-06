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
import type { JwtUser } from '../auth/jwt.strategy';
import { Public } from '../auth/public.decorator';
import { SellerRoleGuard } from '../auth/seller-role.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  findAllCatalog() {
    return this.productsService.findAllActiveCatalog();
  }

  @Public()
  @Get('seller/:sellerId')
  findBySeller(
    @Param('sellerId', new ParseUUIDPipe({ version: '4' })) sellerId: string,
  ) {
    return this.productsService.findActiveBySellerId(sellerId);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.productsService.findOneById(id);
  }

  @Post()
  @UseGuards(SellerRoleGuard)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateProductDto, @Req() req: { user: JwtUser }) {
    return this.productsService.create(dto, req.user.id);
  }
}
