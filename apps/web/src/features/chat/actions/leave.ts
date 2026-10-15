'use server';

import { redirect } from 'next/navigation';
import { getApi } from '@/lib/api';
import { clearSession, readSession } from '../session/session-cookie';

export async function leave(): Promise<void> {
  const session = await readSession();

  if (session) {
    try {
      await getApi().POST('/api/v1/chat/participants/{id}/leave', {
        params: {
          path: { id: session.participantId },
          header: { 'X-Participant-Token': session.token },
        },
      });
    } catch {
      // Any failure still ends the local session (LEAVE-01 AC5).
    }
  }

  await clearSession();
  redirect('/');
}
