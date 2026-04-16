import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { Product } from './entities/product.entity';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  let service: ProductsService;
  const repository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useValue: repository },
      ],
    }).compile();

    service = module.get(ProductsService);
  });

  it('create persiste produto ativo para o vendedor', async () => {
    const dto: CreateProductDto = {
      name: 'P',
      description: 'D',
      price: 9.99,
      stock: 3,
    };
    const sellerId = '550e8400-e29b-41d4-a716-446655440000';
    const entity = { id: 'prod1' } as Product;
    repository.create.mockReturnValue(entity);
    repository.save.mockResolvedValue(entity);

    const result = await service.create(dto, sellerId);

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'P',
        price: '9.99',
        stock: 3,
        sellerId,
        isActive: true,
      }),
    );
    expect(result).toBe(entity);
  });

  it('findOneById lança NotFound quando não existe', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(
      service.findOneById('550e8400-e29b-41d4-a716-446655440000'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findOneById retorna produto quando existe', async () => {
    const product = { id: 'p1', name: 'X' } as Product;
    repository.findOne.mockResolvedValue(product);

    const result = await service.findOneById('p1');

    expect(result).toBe(product);
  });
});
