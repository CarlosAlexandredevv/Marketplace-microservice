export class GatewayRequestException extends Error {
  readonly body: unknown;

  constructor(message: string, body?: unknown) {
    super(message);
    this.name = 'GatewayRequestException';
    this.body = body;
  }
}
