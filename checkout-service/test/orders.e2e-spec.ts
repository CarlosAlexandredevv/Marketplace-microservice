import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { sign } from 'jsonwebtoken';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { E2eSqliteAppModule } from './e2e-sqlite-app.module';
import { Cart, CartStatus } from './../src/cart/entities/cart.entity';
import { CartItem } from './../src/cart/entities/cart-item.entity';
import type { PaymentOrderMessage } from './../src/events/payment-queue.interface';
import { PaymentQueueService } from './../src/events/payment-queue/payment-queue.service';
import { ProductsClientService } from './../src/products-client/products-client.service';
import { CartResponseDto } from './../src/cart/dto/cart-response.dto';
import { OrderResponseDto } from './../src/orders/dto/order-response.dto';
import { Order } from './../src/orders/entities/order.entity';

function expectMoney(value: unknown, expected: string) {
  expect(Number(value).toFixed(2)).toBe(expected);
}

describe('Orders e checkout (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const productsClientMock = {
    getProduct: jest.fn(),
  };
  const publishPaymentOrderSafe = jest.fn().mockResolvedValue(undefined);

  const secret = process.env.JWT_SECRET!;

  function tokenForUser(sub: string): string {
    return sign({ sub, email: `${sub}@test.com`, role: 'buyer' }, secret, {
      expiresIn: '1h',
    });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [E2eSqliteAppModule],
    })
      .overrideProvider(ProductsClientService)
      .useValue(productsClientMock)
      .overrideProvider(PaymentQueueService)
      .useValue({ publishPaymentOrderSafe })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    dataSource = moduleFixture.get(DataSource);
  });

  beforeEach(() => {
    productsClientMock.getProduct.mockImplementation(
      (id: string): ReturnType<ProductsClientService['getProduct']> =>
        Promise.resolve({
          id,
          name: 'Produto mock',
          price: '10.00',
          stock: 5,
          sellerId: '99999999-9999-4999-8999-999999999999',
          isActive: true,
        }),
    );
  });

  afterEach(async () => {
    await dataSource
      .getRepository(Order)
      .createQueryBuilder()
      .delete()
      .execute();
    await dataSource
      .getRepository(CartItem)
      .createQueryBuilder()
      .delete()
      .execute();
    await dataSource
      .getRepository(Cart)
      .createQueryBuilder()
      .delete()
      .execute();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('POST /cart/checkout — 401 sem JWT', () => {
    return request(app.getHttpServer())
      .post('/cart/checkout')
      .send({ paymentMethod: 'pix' })
      .expect(401);
  });

  it('POST /cart/checkout — 400 paymentMethod inválido', async () => {
    const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    await request(app.getHttpServer())
      .post('/cart/checkout')
      .set('Authorization', `Bearer ${tokenForUser(userId)}`)
      .send({ paymentMethod: 'crypto' })
      .expect(400);
    expect(publishPaymentOrderSafe).not.toHaveBeenCalled();
  });

  it('POST /cart/checkout — 422 carrinho vazio (sem linha no banco)', async () => {
    const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    await request(app.getHttpServer())
      .post('/cart/checkout')
      .set('Authorization', `Bearer ${tokenForUser(userId)}`)
      .send({ paymentMethod: 'pix' })
      .expect(422);
    expect(publishPaymentOrderSafe).not.toHaveBeenCalled();
    const orders = await dataSource.getRepository(Order).count();
    expect(orders).toBe(0);
  });

  it('POST /cart/checkout — 201 cria pedido, completa carrinho e publica mensagem', async () => {
    const userId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const productId = '550e8400-e29b-41d4-a716-446655440000';

    const addRes = await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${tokenForUser(userId)}`)
      .send({ productId, quantity: 2 })
      .expect(201);

    const addBody = addRes.body as CartResponseDto;
    const cartId = addBody.id as string;
    expectMoney(addBody.total, '20.00');

    const res = await request(app.getHttpServer())
      .post('/cart/checkout')
      .set('Authorization', `Bearer ${tokenForUser(userId)}`)
      .send({ paymentMethod: 'credit_card' })
      .expect(201);

    const created = res.body as OrderResponseDto;
    expect(created).toMatchObject({
      userId,
      cartId,
      status: 'pending',
      paymentMethod: 'credit_card',
    });
    expectMoney(created.total, '20.00');
    expect(created.orderId).toBeDefined();

    const cart = await dataSource.getRepository(Cart).findOneOrFail({
      where: { id: cartId },
    });
    expect(cart.status).toBe(CartStatus.COMPLETED);

    expect(publishPaymentOrderSafe).toHaveBeenCalledTimes(1);
    const firstCall = publishPaymentOrderSafe.mock.calls[0] as [
      PaymentOrderMessage,
    ];
    const payload = firstCall[0];
    expect(payload.orderId).toBe(created.orderId);
    expect(payload.userId).toBe(userId);
    expect(payload.amount).toBe(20);
    expect(payload.paymentMethod).toBe('credit_card');
    expect(payload.items).toEqual([{ productId, quantity: 2, price: 10 }]);
  });

  it('GET /orders — 401 sem JWT', () => {
    return request(app.getHttpServer()).get('/orders').expect(401);
  });

  it('GET /orders — apenas pedidos do usuário, mais recente primeiro', async () => {
    const userId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const productId = '660e8400-e29b-41d4-a716-446655440000';

    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${tokenForUser(userId)}`)
      .send({ productId, quantity: 1 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/cart/checkout')
      .set('Authorization', `Bearer ${tokenForUser(userId)}`)
      .send({ paymentMethod: 'pix' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${tokenForUser(userId)}`)
      .send({ productId, quantity: 1 })
      .expect(201);

    await new Promise((r) => setTimeout(r, 1100));

    const second = await request(app.getHttpServer())
      .post('/cart/checkout')
      .set('Authorization', `Bearer ${tokenForUser(userId)}`)
      .send({ paymentMethod: 'boleto' })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get('/orders')
      .set('Authorization', `Bearer ${tokenForUser(userId)}`)
      .expect(200);

    const ordersList = list.body as OrderResponseDto[];
    const secondOrder = second.body as OrderResponseDto;
    expect(ordersList).toHaveLength(2);
    expect(ordersList[0].orderId).toBe(secondOrder.orderId);
    expect(ordersList[0].paymentMethod).toBe('boleto');
    expect(ordersList[1].paymentMethod).toBe('pix');
  });

  it('GET /orders — outro usuário não vê pedidos alheios', async () => {
    const userA = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const userB = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    const productId = '770e8400-e29b-41d4-a716-446655440000';

    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${tokenForUser(userA)}`)
      .send({ productId, quantity: 1 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/cart/checkout')
      .set('Authorization', `Bearer ${tokenForUser(userA)}`)
      .send({ paymentMethod: 'debit_card' })
      .expect(201);

    const listB = await request(app.getHttpServer())
      .get('/orders')
      .set('Authorization', `Bearer ${tokenForUser(userB)}`)
      .expect(200);

    expect(listB.body).toEqual([]);
  });

  it('GET /orders/:id — 200 mesmo usuário; 404 outro usuário ou inexistente', async () => {
    const userA = '11111111-1111-4111-8111-111111111111';
    const userB = '22222222-2222-4222-8222-222222222222';
    const productId = '880e8400-e29b-41d4-a716-446655440000';

    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${tokenForUser(userA)}`)
      .send({ productId, quantity: 1 })
      .expect(201);

    const checkout = await request(app.getHttpServer())
      .post('/cart/checkout')
      .set('Authorization', `Bearer ${tokenForUser(userA)}`)
      .send({ paymentMethod: 'pix' })
      .expect(201);

    const checkoutBody = checkout.body as OrderResponseDto;
    const orderId = checkoutBody.orderId;

    const ok = await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .set('Authorization', `Bearer ${tokenForUser(userA)}`)
      .expect(200);

    const okBody = ok.body as OrderResponseDto;
    expect(okBody.orderId).toBe(orderId);

    await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .set('Authorization', `Bearer ${tokenForUser(userB)}`)
      .expect(404);

    await request(app.getHttpServer())
      .get('/orders/550e8400-e29b-41d4-a716-446655440099')
      .set('Authorization', `Bearer ${tokenForUser(userA)}`)
      .expect(404);
  });
});
