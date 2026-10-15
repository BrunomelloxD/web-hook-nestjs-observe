import 'server-only';
import type { OnlineParticipant, OnlineParticipants } from '../chat.types';
import { getOnline } from '../queries/get-online';
import { readSession, type Session } from './session-cookie';

export type ValidSession = {
  session: Session;
  me: OnlineParticipant;
  /** Reused by the header, so the page makes no second call. */
  online: OnlineParticipants;
};

/** Valid = cookie present and its participant is online (JOIN-03 AC13). */
export async function getValidSession(): Promise<ValidSession | null> {
  const session = await readSession();
  if (!session) return null;

  const online = await getOnline();
  const me = online.items.find((p) => p.id === session.participantId);

  return me ? { session, me, online } : null;
}
