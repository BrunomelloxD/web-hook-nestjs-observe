import 'server-only';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { SESSION_COOKIE } from './route-by-session';

export { SESSION_COOKIE };

const sessionSchema = z.object({
  participantId: z.uuid(),
  // base64url has no ".", so the cookie splits on the only dot.
  token: z.string().regex(/^[A-Za-z0-9_-]+$/),
});

export type Session = z.infer<typeof sessionSchema>;

export function encodeSession({ participantId, token }: Session): string {
  return `${participantId}.${token}`;
}

export function decodeSession(value: string | undefined): Session | null {
  const parts = value?.split('.') ?? [];
  if (parts.length !== 2) return null;

  const [participantId, token] = parts;
  const parsed = sessionSchema.safeParse({ participantId, token });
  return parsed.success ? parsed.data : null;
}

export async function readSession(): Promise<Session | null> {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
}

/** Server Actions and Route Handlers only: Server Components can't set cookies. */
export async function writeSession(session: Session): Promise<void> {
  const store = await cookies();
  // No maxAge/expires: a browser-session cookie (JOIN-03 AC10).
  store.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

/** Server Actions and Route Handlers only. */
export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
