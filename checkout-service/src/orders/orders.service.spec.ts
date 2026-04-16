import {
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { PaymentQueueService } from '../events/payment-queue/payment-queue.service';
import { CartItem } from '../cart/entities/cart-item.entity';
import { Cart, CartStatus } from '../cart/entities/cart.entity';
import { MetricsService } from '../metrics/metrics.service';
import { Order, OrderStatus } from './entities/order.entity';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  let service: OrdersService;
  const orderRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const paymentQueueService = {
    publishPaymentOrderSafe: jest.fn(),
  };
  const metricsService = {
    incrementOrdersCreated: jest.fn(),
  };
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    dataSource = {
      transaction: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: orderRepository },
        { provide: DataSource, useValue: dataSource },
        { provide: PaymentQueueService, useValue: paymentQueueService },
        { provide: MetricsService, useValue: metricsService },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  it('findAllForUser retorna pedidos ordenados', async () => {
    const orders = [
      {
        orderId: 'o1',
        userId: 'u1',
        cartId: 'c1',
        amount: '10.00',
        status: OrderStatus.PENDING,
        paymentMethod: 'pix',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as Order[];
    orderRepository.find.mockResolvedValue(orders);

    const result = await service.findAllForUser('u1');

    expect(result).toHaveLength(1);
    expect(result[0].orderId).toBe('o1');
  });

  it('findOneForUser lança NotFound quando pedido não existe', async () => {
    orderRepository.findOne.mockResolvedValue(null);

    await expect(
      service.findOneForUser('u1', '550e8400-e29b-41d4-a716-446655440000'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('checkout lança UnprocessableEntity quando não há carrinho ativo', async () => {
    dataSource.transaction.mockImplementation(
      async (fn: (m: EntityManager) => Promise<unknown>) => {
        const manager = {
          getRepository: (entity: unknown) => {
            if (entity === Cart) {
              return {
                findOne: jest.fn().mockResolvedValue(null),
              };
            }
            return {};
          },
        } as unknown as EntityManager;
        return fn(manager);
      },
    );

    await expect(
      service.checkout('u1', { paymentMethod: 'pix' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('checkout publica na fila e retorna pedido quando fluxo completa', async () => {
    const cartId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const cart = {
      id: cartId,
      userId: 'u1',
      status: CartStatus.ACTIVE,
      total: '20.00',
    } as Cart;
    const lineItems = [
      {
        productId: 'p1',
        quantity: 2,
        price: '10.00',
      },
    ] as CartItem[];

    const savedOrder = {
      orderId: 'order-uuid',
      userId: 'u1',
      cartId,
      amount: '20.00',
      paymentMethod: 'pix',
      status: OrderStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Order;

    dataSource.transaction.mockImplementation(
      async (fn: (m: EntityManager) => Promise<unknown>) => {
        const cartRepo = {
          findOne: jest.fn().mockResolvedValue(cart),
          save: jest.fn().mockResolvedValue(undefined),
        };
        const itemRepo = {
          find: jest.fn().mockResolvedValue(lineItems),
        };
        const orderRepo = {
          create: jest.fn().mockReturnValue(savedOrder),
          save: jest.fn().mockResolvedValue(savedOrder),
        };
        const manager = {
          getRepository: (entity: unknown) => {
            if (entity === Cart) return cartRepo;
            if (entity === CartItem) return itemRepo;
            if (entity === Order) return orderRepo;
            return {};
          },
        } as unknown as EntityManager;
        return fn(manager);
      },
    );
    paymentQueueService.publishPaymentOrderSafe.mockResolvedValue(undefined);

    const result = await service.checkout('u1', { paymentMethod: 'pix' });

    expect(result.orderId).toBe('order-uuid');
    expect(paymentQueueService.publishPaymentOrderSafe).toHaveBeenCalled();
    expect(metricsService.incrementOrdersCreated).toHaveBeenCalled();
  });

  it('checkout lança ServiceUnavailable quando a fila falha', async () => {
    const cartId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const cart = {
      id: cartId,
      userId: 'u1',
      status: CartStatus.ACTIVE,
      total: '10.00',
    } as Cart;
    const lineItems = [
      { productId: 'p1', quantity: 1, price: '10.00' },
    ] as CartItem[];
    const savedOrder = {
      orderId: 'order-uuid',
      userId: 'u1',
      cartId,
      amount: '10.00',
      paymentMethod: 'pix',
      status: OrderStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Order;

    dataSource.transaction.mockImplementation(
      async (fn: (m: EntityManager) => Promise<unknown>) => {
        const cartRepo = {
          findOne: jest.fn().mockResolvedValue(cart),
          save: jest.fn(),
        };
        const itemRepo = {
          find: jest.fn().mockResolvedValue(lineItems),
        };
        const orderRepo = {
          create: jest.fn().mockReturnValue(savedOrder),
          save: jest.fn().mockResolvedValue(savedOrder),
        };
        const manager = {
          getRepository: (entity: unknown) => {
            if (entity === Cart) return cartRepo;
            if (entity === CartItem) return itemRepo;
            if (entity === Order) return orderRepo;
            return {};
          },
        } as unknown as EntityManager;
        return fn(manager);
      },
    );
    paymentQueueService.publishPaymentOrderSafe.mockRejectedValue(
      new Error('queue down'),
    );

    await expect(
      service.checkout('u1', { paymentMethod: 'pix' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
