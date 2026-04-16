process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'e2e-jwt-secret-checkout-service-tests';

if (!process.env.DB_DATABASE) {
  process.env.DB_DATABASE = 'postgres';
}
