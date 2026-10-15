import { z } from 'zod';
import type { ChatMessage } from '../chat.types';

// Typed by the contract: a change in MessageResponseDto breaks the typecheck here.
export const messageSchema: z.ZodType<ChatMessage> = z.object({
  id: z.string(),
  seq: z.number().int(),
  type: z.enum(['USER', 'JOINED', 'LEFT']),
  content: z.string(),
  clientId: z.string().nullable(),
  author: z.object({ id: z.string(), name: z.string() }),
  createdAt: z.iso.datetime(),
});

/** Body of POST /webhooks/chat: { type, occurredAt, data } of a known type. */
export const webhookEnvelopeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('message.created'),
    occurredAt: z.iso.datetime(),
    data: messageSchema,
  }),
  z.object({
    type: z.literal('presence.changed'),
    occurredAt: z.iso.datetime(),
    data: z.object({ online: z.number().int().nonnegative() }),
  }),
]);

export type WebhookEnvelope = z.infer<typeof webhookEnvelopeSchema>;
