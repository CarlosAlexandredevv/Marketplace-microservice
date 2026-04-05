import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Product } from '../src/products/entities/product.entity';
import { createAppValidationPipe } from '../src/validation-pipe.config';

type ProductCreateResponse = {
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

type ValidationErrorResponse = {
  message: string;
  errors: unknown[];
};

describe('POST /products (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let dataSource: DataSource;

  const validBody = () => ({
    name: 'Produto teste',
    description: 'Descrição do produto',
    price: 10.5,
    stock: 5,
  });

  beforeAll(async () => {
    expect(process.env.JWT_SECRET?.trim()).toBeDefined();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(createAppValidationPipe());
    await app.init();
    jwtService = app.get(JwtService);
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('POST /products — não retorna 404 (rota registrada)', async () => {
    const res = await request(app.getHttpServer()).post('/products');
    expect(res.status).not.toBe(404);
  });

  it('POST /products — 401 sem Authorization', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .send(validBody())
      .expect(401);
  });

  it('POST /products — 201 com seller, sellerId = sub do token, isActive true', async () => {
    const sub = randomUUID();
    const token = await jwtService.signAsync({
      sub,
      email: `seller.${sub}@example.com`,
      role: 'seller',
    });

    const res = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody())
      .expect(201);

    const body = res.body as ProductCreateResponse;
    expect(body).toMatchObject({
      name: validBody().name,
      description: validBody().description,
      stock: 5,
      sellerId: sub,
      isActive: true,
    });
    expect(body.id).toBeDefined();
    expect(String(body.price)).toBe('10.50');
    expect(body.createdAt).toBeDefined();
    expect(body.updatedAt).toBeDefined();
  });

  it('POST /products — 403 com buyer e corpo válido; nenhum insert', async () => {
    const before = await dataSource.getRepository(Product).count();
    const token = await jwtService.signAsync({
      sub: randomUUID(),
      email: 'buyer@example.com',
      role: 'buyer',
    });

    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody())
      .expect(403);

    const after = await dataSource.getRepository(Product).count();
    expect(after).toBe(before);
  });

  it('POST /products — 400 com sellerId extra no body (forbidNonWhitelisted)', async () => {
    const sub = randomUUID();
    const token = await jwtService.signAsync({
      sub,
      email: `seller.${sub}@example.com`,
      role: 'seller',
    });

    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ...validBody(),
        sellerId: randomUUID(),
      })
      .expect(400);
  });

  it('POST /products — 400 com isActive no body', async () => {
    const sub = randomUUID();
    const token = await jwtService.signAsync({
      sub,
      email: `seller.${sub}@example.com`,
      role: 'seller',
    });

    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ...validBody(),
        isActive: false,
      })
      .expect(400);
  });

  it('POST /products — 400 nome vazio', async () => {
    const token = await jwtService.signAsync({
      sub: randomUUID(),
      email: 'seller@example.com',
      role: 'seller',
    });

    const res = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody(), name: '' })
      .expect(400);

    const errBody = res.body as ValidationErrorResponse;
    expect(errBody.message).toBe('Erro de validação');
    expect(Array.isArray(errBody.errors)).toBe(true);
  });

  it('POST /products — 400 nome > 255 caracteres', async () => {
    const token = await jwtService.signAsync({
      sub: randomUUID(),
      email: 'seller@example.com',
      role: 'seller',
    });

    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody(), name: 'x'.repeat(256) })
      .expect(400);
  });

  it('POST /products — 400 price 0', async () => {
    const token = await jwtService.signAsync({
      sub: randomUUID(),
      email: 'seller@example.com',
      role: 'seller',
    });

    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody(), price: 0 })
      .expect(400);
  });

  it('POST /products — 400 price negativo', async () => {
    const token = await jwtService.signAsync({
      sub: randomUUID(),
      email: 'seller@example.com',
      role: 'seller',
    });

    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody(), price: -1 })
      .expect(400);
  });

  it('POST /products — 400 price com mais de 2 casas decimais', async () => {
    const token = await jwtService.signAsync({
      sub: randomUUID(),
      email: 'seller@example.com',
      role: 'seller',
    });

    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody(), price: 1.001 })
      .expect(400);
  });

  it('POST /products — 400 stock negativo', async () => {
    const token = await jwtService.signAsync({
      sub: randomUUID(),
      email: 'seller@example.com',
      role: 'seller',
    });

    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody(), stock: -1 })
      .expect(400);
  });

  it('POST /products — 400 stock não inteiro', async () => {
    const token = await jwtService.signAsync({
      sub: randomUUID(),
      email: 'seller@example.com',
      role: 'seller',
    });

    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody(), stock: 1.5 })
      .expect(400);
  });

  it('POST /products — 400 campo obrigatório ausente', async () => {
    const token = await jwtService.signAsync({
      sub: randomUUID(),
      email: 'seller@example.com',
      role: 'seller',
    });

    const b = validBody();
    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        description: b.description,
        price: b.price,
        stock: b.stock,
      })
      .expect(400);
  });
});
