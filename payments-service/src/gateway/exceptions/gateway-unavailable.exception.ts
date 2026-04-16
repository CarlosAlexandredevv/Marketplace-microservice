export class GatewayUnavailableException extends Error {
  constructor(message?: string) {
    super(message ?? 'Gateway unavailable');
    this.name = 'GatewayUnavailableException';
  }
}
