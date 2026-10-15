import 'server-only';
import { redirect } from 'next/navigation';
import { clearSession } from './session-cookie';

/** For GET /session/end: drops the local cookie only, never calls the api. */
export async function endInvalidSession(): Promise<never> {
  await clearSession();
  redirect('/');
}
