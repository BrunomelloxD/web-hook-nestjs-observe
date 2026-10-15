// Lives here, not in session-cookie.ts: the proxy imports it without server-only.
export const SESSION_COOKIE = 'chat_session';

// SPEC_DEVIATION: design typed `pathname` as '/' | '/chat'.
// Reason: the proxy gets a plain string; any other path follows through (null).
/** Optimistic redirect by cookie presence only (AD-002). `null` = let it through. */
export function routeBySession(
  pathname: string,
  hasSessionCookie: boolean,
): '/' | '/chat' | null {
  if (pathname === '/' && hasSessionCookie) return '/chat';
  if (pathname === '/chat' && !hasSessionCookie) return '/';
  return null;
}
