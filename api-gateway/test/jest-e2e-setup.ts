if (!process.env.JWT_SECRET?.trim()) {
  process.env.JWT_SECRET =
    'e2e-gateway-secret-min-32-characters-long-for-jwt-signing!!';
}
