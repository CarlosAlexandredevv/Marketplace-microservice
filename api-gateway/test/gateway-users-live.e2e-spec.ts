import { randomUUID } from 'crypto';
import request from 'supertest';

const baseUrl = process.env.E2E_GATEWAY_URL ?? 'http://127.0.0.1:3011';

const gateway = () => request(baseUrl);

describe('Gateway ↔ Users (live E2E)', () => {
  const uniqueEmail = (label: string) =>
    `e2e.${label}.${randomUUID()}@example.com`;

  it('GET / — gateway responde', async () => {
    await gateway().get('/').expect(200);
  });

  it('POST /auth/register — 201 e POST repetido — 409 com corpo do users-service', async () => {
    const email = uniqueEmail('reg');
    const payload = {
      email,
      password: 'secret12',
      firstName: 'Ada',
      lastName: 'Lovelace',
      role: 'buyer',
    };

    const first = await gateway()
      .post('/auth/register')
      .send(payload)
      .expect(201);

    expect(first.body).toMatchObject({
      email: email.toLowerCase(),
      role: 'buyer',
      status: 'active',
    });
    expect(first.body).not.toHaveProperty('password');

    const second = await gateway()
      .post('/auth/register')
      .send(payload)
      .expect(409);

    expect(second.body).toMatchObject({
      statusCode: 409,
    });
    expect(
      String(
        (second.body as { message?: string | string[] }).message ??
          JSON.stringify(second.body),
      ),
    ).toMatch(/e-mail|email|uso|cadastrado|conflict/i);
  });

  it('POST /auth/login — credenciais inválidas — 401 e mensagem do serviço', async () => {
    const res = await gateway()
      .post('/auth/login')
      .send({
        email: uniqueEmail('nouser'),
        password: 'wrong-password',
      })
      .expect(401);

    expect(res.body).toMatchObject({ statusCode: 401 });
    const msg = (res.body as { message?: string }).message;
    expect(String(msg)).toMatch(/credenciais|invalid/i);
  });

  it('POST /auth/login — sucesso — accessToken + GET /auth/validate-token + /users/profile', async () => {
    const email = uniqueEmail('login');
    const password = 'secret12';

    await gateway()
      .post('/auth/register')
      .send({
        email,
        password,
        firstName: 'Test',
        lastName: 'User',
        role: 'buyer',
      })
      .expect(201);

    const loginRes = await gateway()
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    const { accessToken, user } = loginRes.body as {
      accessToken: string;
      user: { id: string };
    };
    expect(accessToken).toBeDefined();
    expect(user?.id).toBeDefined();

    const validateRes = await gateway()
      .get('/auth/validate-token')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(validateRes.body).toMatchObject({
      userId: user.id,
      email: email.toLowerCase(),
      role: 'buyer',
    });

    const profileRes = await gateway()
      .get('/users/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(profileRes.body).toMatchObject({
      id: user.id,
      email: email.toLowerCase(),
    });
  });
});
