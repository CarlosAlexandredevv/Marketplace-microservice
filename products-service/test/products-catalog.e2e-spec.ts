import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Product } from '../src/products/entities/product.entity';
import { createAppValidationPipe } from '../src/validation-pipe.config';

type ProductResponse = {
  id: string;
  name: string;
  description: string;
  price: string | number;
  stock: number;
  sellerId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

describe('GET /products — catálogo público (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    expect(process.env.JWT_SECRET?.trim()).toBeDefined();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(createAppValidationPipe());
    await app.init();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    await dataSource.getRepository(Product).clear();
  });

  it('GET /products — 200 sem Authorization, corpo é array', async () => {
    const res = await request(app.getHttpServer()).get('/products').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /products — só produtos ativos; inativos não aparecem', async () => {
    const repo = dataSource.getRepository(Product);
    const sellerId = randomUUID();
    await repo.save(
      repo.create({
        name: 'Ativo',
        description: 'd',
        price: '10.00',
        stock: 1,
        sellerId,
        isActive: true,
      }),
    );
    await repo.save(
      repo.create({
        name: 'Inativo',
        description: 'd',
        price: '5.00',
        stock: 0,
        sellerId,
        isActive: false,
      }),
    );

    const res = await request(app.getHttpServer()).get('/products').expect(200);
    const list = res.body as ProductResponse[];
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Ativo');
    expect(list[0].isActive).toBe(true);
  });

  it('GET /products — ordenação createdAt DESC (mais recente primeiro)', async () => {
    const repo = dataSource.getRepository(Product);
    const sellerId = randomUUID();
    const older = await repo.save(
      repo.create({
        name: 'Mais antigo',
        description: 'd',
        price: '1.00',
        stock: 1,
        sellerId,
        isActive: true,
      }),
    );
    const newer = await repo.save(
      repo.create({
        name: 'Mais recente',
        description: 'd',
        price: '2.00',
        stock: 1,
        sellerId,
        isActive: true,
      }),
    );

    await dataSource.query('UPDATE products SET created_at = ? WHERE id = ?', [
      '2020-01-01T00:00:00.000Z',
      older.id,
    ]);
    await dataSource.query('UPDATE products SET created_at = ? WHERE id = ?', [
      '2025-06-01T00:00:00.000Z',
      newer.id,
    ]);

    const res = await request(app.getHttpServer()).get('/products').expect(200);
    const list = res.body as ProductResponse[];
    expect(list[0].id).toBe(newer.id);
    expect(list[1].id).toBe(older.id);
  });

  it('GET /products/seller/:sellerId — 200 sem token; só ativos daquele vendedor', async () => {
    const repo = dataSource.getRepository(Product);
    const sellerA = randomUUID();
    const sellerB = randomUUID();
    await repo.save(
      repo.create({
        name: 'A1',
        description: 'd',
        price: '1.00',
        stock: 1,
        sellerId: sellerA,
        isActive: true,
      }),
    );
    await repo.save(
      repo.create({
        name: 'A2 inativo',
        description: 'd',
        price: '1.00',
        stock: 1,
        sellerId: sellerA,
        isActive: false,
      }),
    );
    await repo.save(
      repo.create({
        name: 'B1',
        description: 'd',
        price: '1.00',
        stock: 1,
        sellerId: sellerB,
        isActive: true,
      }),
    );

    const res = await request(app.getHttpServer())
      .get(`/products/seller/${sellerA}`)
      .expect(200);
    const list = res.body as ProductResponse[];
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('A1');
  });

  it('GET /products/seller/:sellerId — vendedor sem produtos → 200 e []', async () => {
    const res = await request(app.getHttpServer())
      .get(`/products/seller/${randomUUID()}`)
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it('GET /products/seller/:uuid — rota por vendedor, não confunde com GET /products/:id', async () => {
    const sellerId = randomUUID();
    await dataSource.getRepository(Product).save(
      dataSource.getRepository(Product).create({
        name: 'Loja',
        description: 'd',
        price: '3.00',
        stock: 2,
        sellerId,
        isActive: true,
      }),
    );

    const res = await request(app.getHttpServer())
      .get(`/products/seller/${sellerId}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body as ProductResponse[]).toHaveLength(1);
  });

  it('GET /products/:id — 200 quando existe', async () => {
    const repo = dataSource.getRepository(Product);
    const saved = await repo.save(
      repo.create({
        name: 'Detalhe',
        description: 'd',
        price: '9.99',
        stock: 3,
        sellerId: randomUUID(),
        isActive: true,
      }),
    );

    const res = await request(app.getHttpServer())
      .get(`/products/${saved.id}`)
      .expect(200);
    const body = res.body as ProductResponse;
    expect(body.id).toBe(saved.id);
    expect(body.name).toBe('Detalhe');
    expect(String(body.price)).toBe('9.99');
  });

  it('GET /products/:id — 404 UUID válido inexistente', async () => {
    await request(app.getHttpServer())
      .get(`/products/${randomUUID()}`)
      .expect(404);
  });

  it('POST /products — 401 sem Authorization (permanece protegido)', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .send({
        name: 'x',
        description: 'y',
        price: 1,
        stock: 1,
      })
      .expect(401);
  });
});
