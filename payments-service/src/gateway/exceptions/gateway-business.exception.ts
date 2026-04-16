export class GatewayBusinessException extends Error {
  constructor(message?: string) {
    super(message ?? 'Gateway business error');
    this.name = 'GatewayBusinessException';
  }
}
