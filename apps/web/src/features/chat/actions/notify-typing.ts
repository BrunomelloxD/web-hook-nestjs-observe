'use server';

import { getApi } from '@/lib/api';
import { readSession } from '../session/session-cookie';

/**
 * Tells the room the participant is typing (TYPE-01). The notice is
 * disposable: every error is ignored, and a 401 neither refreshes nor
 * redirects, so typing never takes the person out of the room. The next send
 * deals with an expired session.
 */
export async function notifyTyping(): Promise<void> {
  const session = await readSession();
  if (!session) return;

  try {
    await getApi().POST('/api/v1/chat/typing', {
      params: { header: { 'X-Participant-Token': session.token } },
    });
  } catch {
    // Network failure: the next keystroke tries again.
  }
}
