'use server';

import { redirect } from 'next/navigation';
import { getApi } from '@/lib/api';
import {
  messageSchema,
  type MessageInput,
  type SendMessageResult,
} from '../schemas/message.schema';
import { clearSession, readSession } from '../session/session-cookie';

async function endSession(): Promise<never> {
  await clearSession();
  redirect('/');
}

// Public POST endpoint: check the session and validate before calling the api.
export async function sendMessage(
  input: MessageInput,
): Promise<SendMessageResult> {
  const session = await readSession();
  if (!session) return endSession();

  const parsed = messageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };

  const { data, response } = await getApi().POST('/api/v1/chat/messages', {
    params: { header: { 'X-Participant-Token': session.token } },
    body: parsed.data,
  });

  if (response.status === 401) return endSession();
  if (!data) return { ok: false, reason: 'unexpected' };

  // No refresh(): the own message reaches the list over SSE, like everyone's.
  return { ok: true, message: data };
}
