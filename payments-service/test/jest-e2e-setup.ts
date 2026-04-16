if (!process.env.JWT_SECRET?.trim()) {
  process.env.JWT_SECRET =
    'e2e-payments-jwt-secret-min-32-chars-for-testing-only!!';
}

jest.mock('../src/payments/entities/payment.entity', () =>
  require('./sqlite-payment.entity.stub'),
);
