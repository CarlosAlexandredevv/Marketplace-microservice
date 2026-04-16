import * as crypto from 'node:crypto';

export function verifyAbacateWebhookSignature(
  rawBody: string,
  signatureFromHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureFromHeader?.trim() || !secret) {
    return false;
  }
  const expected = crypto
    .createHmac('sha256', secret)
    .update(Buffer.from(rawBody, 'utf8'))
    .digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureFromHeader);
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

export function verifyWebhookQuerySecret(
  queryValue: string | undefined,
  secret: string,
): boolean {
  if (!queryValue || !secret) {
    return false;
  }
  const a = Buffer.from(queryValue);
  const b = Buffer.from(secret);
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}
