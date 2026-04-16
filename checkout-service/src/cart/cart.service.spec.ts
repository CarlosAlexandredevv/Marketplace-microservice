import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ProductsClientService } from '../products-client/products-client.service';
import { CartService } from './cart.service';
import { Cart, CartStatus } from './entities/cart.entity';

describe('CartService', () => {
  it('getActiveCartForUser retorna carrinho vazio sintético quando não há carrinho', async () => {
    const cartRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    } as unknown as Repository<Cart>;

    const dataSource = {} as DataSource;
    const productsClient = {} as ProductsClientService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: getRepositoryToken(Cart), useValue: cartRepository },
        { provide: DataSource, useValue: dataSource },
        { provide: ProductsClientService, useValue: productsClient },
      ],
    }).compile();

    const service = module.get(CartService);
    const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const result = await service.getActiveCartForUser(userId);

    expect(result).toEqual({
      id: null,
      userId,
      status: CartStatus.ACTIVE,
      total: '0.00',
      items: [],
    });
    expect(cartRepository.findOne).toHaveBeenCalledWith({
      where: { userId, status: CartStatus.ACTIVE },
      relations: ['items'],
    });
  });
});
