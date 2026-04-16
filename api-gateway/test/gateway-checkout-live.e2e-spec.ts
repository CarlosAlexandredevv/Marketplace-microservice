import { randomUUID } from 'crypto';
import request from 'supertest';

const baseUrl = process.env.E2E_GATEWAY_URL ?? 'http://127.0.0.1:3011';

const gateway = () => request(baseUrl);

interface CartResponse {
  userId: string;
  total: string;
  items: unknown[];
}

interface OrderResponse {
  orderId: string;
  userId: string;
  total: string;
  paymentMethod: string;
}

describe('Gateway ↔ Checkout (live E2E)', () => {
  const uniqueEmail = (label: string) =>
    `e2e.checkout.${label}.${randomUUID()}@example.com`;

  it('POST /cart/items -> GET /cart -> POST /cart/checkout -> GET /orders', async () => {
    const email = uniqueEmail('seller');
    const password = 'secret12';

    await gateway()
      .post('/auth/register')
      .send({
        email,
        password,
        firstName: 'Checkout',
        lastName: 'Seller',
        role: 'seller',
      })
      .expect(201);

    const loginRes = await gateway()
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    const { accessToken } = loginRes.body as { accessToken: string };
    expect(accessToken).toBeDefined();

    const productRes = await gateway()
      .post('/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: `Produto E2E ${randomUUID()}`,
        description: 'Produto para fluxo E2E de checkout via gateway',
        price: 31.0,
        stock: 8,
      })
      .expect(201);

    const { id: productId } = productRes.body as { id: string };
    expect(productId).toBeDefined();

    const addItemRes = await gateway()
      .post('/cart/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ productId, quantity: 1 })
      .expect(201);
    const addItemBody = addItemRes.body as CartResponse;

    expect(typeof addItemBody.userId).toBe('string');
    expect(typeof addItemBody.total).toBe('string');
    expect(Array.isArray(addItemBody.items)).toBe(true);
    expect(addItemBody.items.length).toBeGreaterThan(0);

    const cartRes = await gateway()
      .get('/cart')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const cartBody = cartRes.body as CartResponse;

    expect(typeof cartBody.userId).toBe('string');
    expect(typeof cartBody.total).toBe('string');
    expect(Array.isArray(cartBody.items)).toBe(true);
    expect(cartBody.items.length).toBeGreaterThan(0);

    const checkoutRes = await gateway()
      .post('/cart/checkout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ paymentMethod: 'pix' })
      .expect(201);
    const checkoutBody = checkoutRes.body as OrderResponse;

    expect(typeof checkoutBody.orderId).toBe('string');
    expect(typeof checkoutBody.userId).toBe('string');
    expect(typeof checkoutBody.total).toBe('string');
    expect(checkoutBody.paymentMethod).toBe('pix');

    const ordersRes = await gateway()
      .get('/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const ordersBody = ordersRes.body as Array<{ orderId: string }>;

    expect(Array.isArray(ordersBody)).toBe(true);
    expect(ordersBody.length).toBeGreaterThan(0);

    const [firstOrder] = ordersBody;
    expect(firstOrder.orderId).toBeDefined();

    await gateway()
      .get(`/orders/${firstOrder.orderId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });
});
