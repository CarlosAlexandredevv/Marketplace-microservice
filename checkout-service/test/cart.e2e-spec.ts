import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { sign } from 'jsonwebtoken';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module';
import { Cart, CartStatus } from './../src/cart/entities/cart.entity';
import { CartItem } from './../src/cart/entities/cart-item.entity';
import { ProductsClientService } from './../src/products-client/products-client.service';

describe('CartController (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const productsClientMock = {
    getProduct: jest.fn(),
  };

  const secret = process.env.JWT_SECRET!;

  function tokenForUser(sub: string): string {
    return sign({ sub, email: `${sub}@test.com`, role: 'buyer' }, secret, {
      expiresIn: '1h',
    });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ProductsClientService)
      .useValue(productsClientMock)
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
    productsClientMock.getProduct.mockImplementation(async (id: string) => ({
      id,
      name: 'Produto mock',
      price: '10.00',
      stock: 5,
      sellerId: '99999999-9999-4999-8999-999999999999',
      isActive: true,
    }));
  });

  afterEach(async () => {
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

  it('GET /cart — 401 sem JWT', () => {
    return request(app.getHttpServer()).get('/cart').expect(401);
  });

  it('POST /cart/items — 401 sem JWT', () => {
    return request(app.getHttpServer())
      .post('/cart/items')
      .send({
        productId: '550e8400-e29b-41d4-a716-446655440000',
        quantity: 1,
      })
      .expect(401);
  });

  it('DELETE /cart/items/:id — 401 sem JWT', () => {
    return request(app.getHttpServer())
      .delete('/cart/items/550e8400-e29b-41d4-a716-446655440001')
      .expect(401);
  });

  it('GET /cart —200 carrinho vazio sem linha no banco', async () => {
    const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const res = await request(app.getHttpServer())
      .get('/cart')
      .set('Authorization', `Bearer ${tokenForUser(userId)}`)
      .expect(200);

    expect(res.body).toMatchObject({
      id: null,
      userId,
      status: 'active',
      total: '0.00',
      items: [],
    });

    const count = await dataSource.getRepository(Cart).count();
    expect(count).toBe(0);
  });

  it('POST /cart/items — 201 adiciona item, subtotal e total corretos', async () => {
    const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const productId = '550e8400-e29b-41d4-a716-446655440000';
    productsClientMock.getProduct.mockResolvedValue({
      id: productId,
      name: 'Item A',
      price: '15.50',
      stock: 10,
      sellerId: '88888888-8888-4888-8888-888888888888',
      isActive: true,
    });

    const res = await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${tokenForUser(userId)}`)
      .send({ productId, quantity: 2 })
      .expect(201);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      productId,
      productName: 'Item A',
      price: '15.50',
      quantity: 2,
      subtotal: '31.00',
    });
    expect(res.body.total).toBe('31.00');
    expect(res.body.id).toBeDefined();
  });

  it('POST /cart/items — merge mesma productId soma quantidade e atualiza snapshot', async () => {
    const userId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const productId = '660e8400-e29b-41d4-a716-446655440000';

    productsClientMock.getProduct.mockResolvedValueOnce({
      id: productId,
      name: 'Primeiro nome',
      price: '10.00',
      stock: 10,
      sellerId: '77777777-7777-4777-8777-777777777777',
      isActive: true,
    });

    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${tokenForUser(userId)}`)
      .send({ productId, quantity: 1 })
      .expect(201);

    productsClientMock.getProduct.mockResolvedValueOnce({
      id: productId,
      name: 'Nome atualizado',
      price: '12.00',
      stock: 8,
      sellerId: '77777777-7777-4777-8777-777777777777',
      isActive: true,
    });

    const res = await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${tokenForUser(userId)}`)
      .send({ productId, quantity: 2 })
      .expect(201);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].quantity).toBe(3);
    expect(res.body.items[0].productName).toBe('Nome atualizado');
    expect(res.body.items[0].price).toBe('12.00');
    expect(res.body.items[0].subtotal).toBe('36.00');
    expect(res.body.total).toBe('36.00');
  });

  it('POST /cart/items — 422 produto inativo, sem item novo', async () => {
    const userId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const productId = '770e8400-e29b-41d4-a716-446655440000';
    productsClientMock.getProduct.mockResolvedValue({
      id: productId,
      name: 'Inativo',
      price: '1.00',
      stock: 0,
      sellerId: '66666666-6666-4666-8666-666666666666',
      isActive: false,
    });

    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${tokenForUser(userId)}`)
      .send({ productId, quantity: 1 })
      .expect(422);

    const items = await dataSource.getRepository(CartItem).count();
    expect(items).toBe(0);
  });

  it('POST /cart/items — 404 quando catálogo não encontra produto', async () => {
    const userId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const productId = '880e8400-e29b-41d4-a716-446655440000';
    productsClientMock.getProduct.mockRejectedValue(
      new NotFoundException('Produto não encontrado'),
    );

    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${tokenForUser(userId)}`)
      .send({ productId, quantity: 1 })
      .expect(404);
  });

  it('POST /cart/items — 400 quantity inválida', async () => {
    const userId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${tokenForUser(userId)}`)
      .send({
        productId: '550e8400-e29b-41d4-a716-446655440000',
        quantity: 0,
      })
      .expect(400);
  });

  it('GET /cart — outro usuário não vê itens do carrinho alheio', async () => {
    const userA = '11111111-1111-4111-8111-111111111111';
    const userB = '22222222-2222-4222-8222-222222222222';
    const productId = '990e8400-e29b-41d4-a716-446655440000';

    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${tokenForUser(userA)}`)
      .send({ productId, quantity: 1 })
      .expect(201);

    const resB = await request(app.getHttpServer())
      .get('/cart')
      .set('Authorization', `Bearer ${tokenForUser(userB)}`)
      .expect(200);

    expect(resB.body.items).toEqual([]);
    expect(resB.body.total).toBe('0.00');
  });

  it('DELETE /cart/items/:itemId — remove e recalcula total; outro usuário recebe 404', async () => {
    const userA = '33333333-3333-4333-8333-333333333333';
    const userB = '44444444-4444-4444-8444-444444444444';
    const productId = 'aa0e8400-e29b-41d4-a716-446655440000';

    const addRes = await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${tokenForUser(userA)}`)
      .send({ productId, quantity: 1 })
      .expect(201);

    const itemId = addRes.body.items[0].id as string;

    await request(app.getHttpServer())
      .delete(`/cart/items/${itemId}`)
      .set('Authorization', `Bearer ${tokenForUser(userB)}`)
      .expect(404);

    const afterWrong = await request(app.getHttpServer())
      .get('/cart')
      .set('Authorization', `Bearer ${tokenForUser(userA)}`)
      .expect(200);
    expect(afterWrong.body.items).toHaveLength(1);

    const delRes = await request(app.getHttpServer())
      .delete(`/cart/items/${itemId}`)
      .set('Authorization', `Bearer ${tokenForUser(userA)}`)
      .expect(200);

    expect(delRes.body.items).toEqual([]);
    expect(delRes.body.total).toBe('0.00');
  });

  it('no máximo um carrinho active por usuário após fluxos de POST', async () => {
    const userId = '55555555-5555-4555-8555-555555555555';
    const p1 = 'bb0e8400-e29b-41d4-a716-446655440000';
    const p2 = 'cc0e8400-e29b-41d4-a716-446655440000';

    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${tokenForUser(userId)}`)
      .send({ productId: p1, quantity: 1 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${tokenForUser(userId)}`)
      .send({ productId: p2, quantity: 1 })
      .expect(201);

    const activeCarts = await dataSource.getRepository(Cart).count({
      where: { userId, status: CartStatus.ACTIVE },
    });
    expect(activeCarts).toBe(1);
  });
});
