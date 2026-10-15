import { createHmac } from 'node:crypto';

// Official Standard Webhooks vector secret (same as the api signing spec), valid for the env regex.
export const TEST_WEBHOOK_SECRET = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw';

/** Standard Webhooks headers for `body`, signed like the api does. */
export function signTestWebhook({
  id = 'msg_test',
  timestamp = Math.floor(Date.now() / 1000),
  body,
  secret = TEST_WEBHOOK_SECRET,
}: {
  id?: string;
  timestamp?: number;
  body: string;
  secret?: string;
}): Record<'webhook-id' | 'webhook-timestamp' | 'webhook-signature', string> {
  const key = Buffer.from(secret.slice('whsec_'.length), 'base64');
  const digest = createHmac('sha256', key)
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64');

  return {
    'webhook-id': id,
    'webhook-timestamp': String(timestamp),
    'webhook-signature': `v1,${digest}`,
  };
}
