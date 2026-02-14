export interface TimeoutOptions {
  timeout: number;
  retries: number;
  backOffMultiplier: number;
  maxBackOff: number;
}
