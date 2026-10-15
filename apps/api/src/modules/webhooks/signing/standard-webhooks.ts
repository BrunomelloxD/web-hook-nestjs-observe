import { createHmac } from 'node:crypto';

const SECRET_PREFIX = 'whsec_';

/** The HMAC key is the base64 after the whsec_ prefix (Standard Webhooks). */
export function decodeSecret(secret: string): Buffer {
  return Buffer.from(secret.slice(SECRET_PREFIX.length), 'base64');
}

/** webhook-signature value: v1,base64(HMAC-SHA256(key, "id.timestamp.body")). */
export function signWebhook({
  key,
  id,
  timestamp,
  body,
}: {
  key: Buffer;
  id: string;
  timestamp: number;
  body: string;
}): string {
  const digest = createHmac('sha256', key)
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64');
  return `v1,${digest}`;
}
