import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { JwtUser } from '../auth/jwt.strategy';
import { SellerRoleGuard } from '../auth/seller-role.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseGuards(SellerRoleGuard)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateProductDto, @Req() req: { user: JwtUser }) {
    return this.productsService.create(dto, req.user.id);
  }
}
