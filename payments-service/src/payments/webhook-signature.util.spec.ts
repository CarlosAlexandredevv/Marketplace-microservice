import {
  verifyAbacateWebhookSignature,
  verifyWebhookQuerySecret,
} from './webhook-signature.util';
import * as crypto from 'node:crypto';

describe('webhook-signature.util', () => {
  const secret = 'test-secret';
  const body = '{"event":"billing.paid","data":{"id":"x"}}';

  it('valida assinatura HMAC base64', () => {
    const sig = crypto
      .createHmac('sha256', secret)
      .update(Buffer.from(body, 'utf8'))
      .digest('base64');
    expect(verifyAbacateWebhookSignature(body, sig, secret)).toBe(true);
    expect(verifyAbacateWebhookSignature(body, 'wrong', secret)).toBe(false);
  });

  it('valida query secret com timing-safe', () => {
    expect(verifyWebhookQuerySecret(secret, secret)).toBe(true);
    expect(verifyWebhookQuerySecret('other', secret)).toBe(false);
  });
});
