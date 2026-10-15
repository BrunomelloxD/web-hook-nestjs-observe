import 'server-only';
import { getEnv } from '@/lib/env';
import { webhookEnvelopeSchema } from '../schemas/webhook-envelope.schema';
import { getChatHub } from './chat-hub';
import { getRecentIds } from './recent-ids';
import { verifyWebhook } from './verify-webhook';

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** POST /webhooks/chat: verify, dedupe and publish to the hub, with no network call (WHIN-01, WHIN-02). */
export async function handleChatWebhook(request: Request): Promise<Response> {
  // The signature covers the exact bytes sent, so never re-serialize the body.
  const rawBody = await request.text();
  const id = request.headers.get('webhook-id');

  const verified = verifyWebhook({
    id,
    timestamp: request.headers.get('webhook-timestamp'),
    signature: request.headers.get('webhook-signature'),
    rawBody,
    secret: getEnv().WEBHOOK_SECRET,
    nowSeconds: Math.floor(Date.now() / 1000),
  });
  if (!verified.ok) {
    // No body in the log: it may carry message content.
    console.warn('Webhook recusado', {
      reason: verified.reason,
      webhookId: id,
    });
    return new Response(null, { status: 401 });
  }

  const envelope = webhookEnvelopeSchema.safeParse(parseJson(rawBody));
  if (!envelope.success) return new Response(null, { status: 400 });

  // verifyWebhook only passes with an id.
  const webhookId = id as string;
  const recentIds = getRecentIds();
  if (!recentIds.has(webhookId)) {
    recentIds.add(webhookId);
    getChatHub().publish(envelope.data);
  }

  return new Response(null, { status: 204 });
}
