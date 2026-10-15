import 'server-only';
// Default import so the spec can spy on timingSafeEqual (module mocks don't reach builtins here).
import crypto from 'node:crypto';

const SECRET_PREFIX = 'whsec_';
const SIGNATURE_PREFIX = 'v1,';
const TOLERANCE_SECONDS = 300;

export type VerifyWebhookResult =
  { ok: true } | { ok: false; reason: 'missing' | 'timestamp' | 'signature' };

/** Standard Webhooks verification over the raw body bytes (WHIN-01). */
export function verifyWebhook({
  id,
  timestamp,
  signature,
  rawBody,
  secret,
  nowSeconds,
}: {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  rawBody: string;
  secret: string;
  nowSeconds: number;
}): VerifyWebhookResult {
  if (!id || !timestamp || !signature) return { ok: false, reason: 'missing' };

  if (
    !/^\d+$/.test(timestamp) ||
    Math.abs(nowSeconds - Number(timestamp)) > TOLERANCE_SECONDS
  ) {
    return { ok: false, reason: 'timestamp' };
  }

  const key = Buffer.from(secret.slice(SECRET_PREFIX.length), 'base64');
  const expected = Buffer.from(
    crypto
      .createHmac('sha256', key)
      .update(`${id}.${timestamp}.${rawBody}`)
      .digest('base64'),
  );

  // The header may carry several space-separated signatures (key rotation).
  const matches = signature
    .split(' ')
    .filter((entry) => entry.startsWith(SIGNATURE_PREFIX))
    .map((entry) => Buffer.from(entry.slice(SIGNATURE_PREFIX.length)))
    .some(
      (candidate) =>
        candidate.length === expected.length &&
        crypto.timingSafeEqual(candidate, expected),
    );

  return matches ? { ok: true } : { ok: false, reason: 'signature' };
}
