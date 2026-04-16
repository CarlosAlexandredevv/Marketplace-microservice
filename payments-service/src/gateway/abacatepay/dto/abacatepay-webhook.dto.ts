export interface AbacatePayWebhookPayload {
  event?: string;
  devMode?: boolean;
  data: {
    id: string;
    status?: string;
    externalId?: string;
    amount?: number;
    [key: string]: unknown;
  };
}
