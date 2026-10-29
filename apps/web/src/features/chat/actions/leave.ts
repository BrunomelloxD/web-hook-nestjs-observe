'use server';

import { redirect } from 'next/navigation';
import { getChatHub } from '../realtime/chat-hub';
import { leaveParticipant } from '../session/leave-participant';
import { clearSession, readSession } from '../session/session-cookie';

export async function leave(): Promise<void> {
  const session = await readSession();

  if (session) {
    // Cancels a leave already scheduled (AWAY-01 AC5). The redirect then closes
    // the stream, which schedules a new one: 30 s later the api answers 401 to
    // the old token and the result is discarded (AWAY-01 AC6).
    getChatHub().cancelAway(session.participantId);
    // Any failure still ends the local session (LEAVE-01 AC5).
    await leaveParticipant({ id: session.participantId, token: session.token });
  }

  await clearSession();
  redirect('/');
}
