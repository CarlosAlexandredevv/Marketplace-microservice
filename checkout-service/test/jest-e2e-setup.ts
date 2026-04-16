process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'e2e-jwt-secret-checkout-service-tests';

process.env.PRODUCTS_SERVICE_URL =
  process.env.PRODUCTS_SERVICE_URL || 'http://localhost:3001';

if (!process.env.DB_DATABASE) {
  process.env.DB_DATABASE = 'postgres';
}
