import { randomUUID } from 'crypto';
import request from 'supertest';

const baseUrl = process.env.E2E_GATEWAY_URL ?? 'http://127.0.0.1:3005';

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

interface PaymentResponse {
  id: string;
  orderId: string;
  status: 'approved' | 'rejected';
}

const uniqueEmail = (label: string) =>
  `e2e.payments.${label}.${randomUUID()}@example.com`;

async function createUserAndLogin(role: 'seller' | 'buyer') {
  const email = uniqueEmail(role);
  const password = 'secret12';

  await gateway()
    .post('/auth/register')
    .send({
      email,
      password,
      firstName: 'E2E',
      lastName: role === 'seller' ? 'Seller' : 'Buyer',
      role,
    })
    .expect(201);

  const loginRes = await gateway()
    .post('/auth/login')
    .send({ email, password })
    .expect(200);

  const { accessToken } = loginRes.body as { accessToken: string };
  return { email, password, accessToken };
}

async function createProduct(
  sellerToken: string,
  price: number,
): Promise<string> {
  const productRes = await gateway()
    .post('/products')
    .set('Authorization', `Bearer ${sellerToken}`)
    .send({
      name: `Produto E2E ${randomUUID()}`,
      description: 'Produto para fluxo E2E de pagamentos via gateway',
      price,
      stock: 8,
    })
    .expect(201);

  const { id: productId } = productRes.body as { id: string };
  return productId;
}

async function checkoutOrder(
  buyerToken: string,
  productId: string,
): Promise<OrderResponse> {
  const addItemRes = await gateway()
    .post('/cart/items')
    .set('Authorization', `Bearer ${buyerToken}`)
    .send({ productId, quantity: 1 })
    .expect(201);

  const addItemBody = addItemRes.body as CartResponse;
  expect(Array.isArray(addItemBody.items)).toBe(true);
  expect(addItemBody.items.length).toBeGreaterThan(0);

  await gateway()
    .get('/cart')
    .set('Authorization', `Bearer ${buyerToken}`)
    .expect(200);

  const checkoutRes = await gateway()
    .post('/cart/checkout')
    .set('Authorization', `Bearer ${buyerToken}`)
    .send({ paymentMethod: 'credit_card' })
    .expect(201);

  return checkoutRes.body as OrderResponse;
}

async function waitForPaymentStatus(
  buyerToken: string,
  orderId: string,
  expectedStatus: 'approved' | 'rejected',
) {
  const maxAttempts = 20;
  const delayMs = 1000;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const res = await gateway()
      .get(`/payments/${orderId}`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200);

    const body = res.body as PaymentResponse | null;

    if (body && body.status === expectedStatus) {
      return body;
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(
    `Payment for order ${orderId} did not reach status ${expectedStatus} in time`,
  );
}

describe('Gateway ↔ Payments (live E2E)', () => {
  it(' Cenário 1: pagamento aprovado para produto com preço normal', async () => {
    const seller = await createUserAndLogin('seller');
    const buyer = await createUserAndLogin('buyer');

    const productId = await createProduct(seller.accessToken, 100.0);

    const order = await checkoutOrder(buyer.accessToken, productId);
    expect(typeof order.orderId).toBe('string');

    const payment = await waitForPaymentStatus(
      buyer.accessToken,
      order.orderId,
      'approved',
    );

    expect(payment.orderId).toBe(order.orderId);
    expect(payment.status).toBe('approved');
  });

  it('Cenário 2: pagamento rejeitado para produto com preço terminando em .99', async () => {
    const seller = await createUserAndLogin('seller');
    const buyer = await createUserAndLogin('buyer');

    const productId = await createProduct(seller.accessToken, 99.99);

    const order = await checkoutOrder(buyer.accessToken, productId);
    expect(typeof order.orderId).toBe('string');

    const payment = await waitForPaymentStatus(
      buyer.accessToken,
      order.orderId,
      'rejected',
    );

    expect(payment.orderId).toBe(order.orderId);
    expect(payment.status).toBe('rejected');
  });
});
