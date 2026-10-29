import { z } from 'zod';
import { chatDictionary as t } from '../chat.dictionary';
import type { ChatMessage } from '../chat.types';

const MAX_CHARS = 1000;

export const messageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1)
    // Code points, not UTF-16 units: an emoji is one character, as in the api and the database.
    .refine(
      (value) => Array.from(value).length <= MAX_CHARS,
      t.errors.messageTooLong,
    ),
  clientId: z.uuid(),
});

export type MessageInput = { content: string; clientId: string };

export type SendMessageResult =
  | { ok: true; message: ChatMessage }
  | { ok: false; reason: 'invalid' | 'unexpected' }
  /** `retryAfter` in seconds, from the api's `Retry-After` (RATE-02). */
  | { ok: false; reason: 'rate_limited'; retryAfter: number };

/** Lives here, not in actions/, so components can type the prop. */
export type SendMessageAction = (
  input: MessageInput,
) => Promise<SendMessageResult>;
