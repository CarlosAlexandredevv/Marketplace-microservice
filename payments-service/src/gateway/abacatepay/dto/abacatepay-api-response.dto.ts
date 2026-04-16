export interface AbacatePayApiEnvelope<T> {
  data: T | null;
  error: string | null;
}

export interface AbacatePayBillingData {
  id: string;
  url: string;
  status: string;
}

export interface AbacatePayPixData {
  id: string;
  status: string;
  brCode?: string;
  brCodeBase64?: string;
  expiresAt?: string;
}
