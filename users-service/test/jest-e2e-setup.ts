if (!process.env.JWT_SECRET?.trim()) {
  process.env.JWT_SECRET =
    'e2e-test-jwt-secret-do-not-use-in-production-min-32-chars';
}

jest.mock('../src/users/entities/user.entity', () =>
  require('./sqlite-user.entity.stub'),
);
