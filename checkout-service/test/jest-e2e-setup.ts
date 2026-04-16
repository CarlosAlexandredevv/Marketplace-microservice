process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'e2e-jwt-secret-checkout-service-tests';

process.env.PRODUCTS_SERVICE_URL =
  process.env.PRODUCTS_SERVICE_URL || 'http://localhost:3001';

if (!process.env.DB_DATABASE) {
  process.env.DB_DATABASE = 'postgres';
}

jest.mock('../src/cart/entities/cart.entity', () =>
  require('./sqlite-checkout-entities.stub'),
);
jest.mock('../src/cart/entities/cart-item.entity', () =>
  require('./sqlite-checkout-entities.stub'),
);
jest.mock('../src/orders/entities/order.entity', () =>
  require('./sqlite-checkout-entities.stub'),
);

import { Repository } from 'typeorm';

function stripLock<T extends { lock?: unknown }>(options?: T): T | undefined {
  if (options && typeof options === 'object' && 'lock' in options) {
    const { lock: _lock, ...rest } = options;
    return rest as T;
  }
  return options;
}

const repoFindOne = Repository.prototype.findOne;
Repository.prototype.findOne = function (options?: object) {
  return repoFindOne.call(this, stripLock(options));
};

const repoFindOneOrFail = Repository.prototype.findOneOrFail;
Repository.prototype.findOneOrFail = function (options?: object) {
  return repoFindOneOrFail.call(this, stripLock(options));
};
