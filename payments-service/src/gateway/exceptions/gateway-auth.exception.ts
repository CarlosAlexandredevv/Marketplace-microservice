export class GatewayAuthException extends Error {
  constructor(message?: string) {
    super(message ?? 'Gateway authentication failed');
    this.name = 'GatewayAuthException';
  }
}
