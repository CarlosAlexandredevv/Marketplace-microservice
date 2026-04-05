import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  async create(dto: CreateProductDto, sellerId: string): Promise<Product> {
    const product = this.productsRepository.create({
      name: dto.name,
      description: dto.description,
      price: dto.price.toFixed(2),
      stock: dto.stock,
      sellerId,
      isActive: true,
    });
    return this.productsRepository.save(product);
  }
}
