import { NextResponse, type NextRequest } from 'next/server';
// SPEC_DEVIATION: design imports routeBySession from '@/features/chat'.
// Reason: the index pulls actions, env and zod into the proxy bundle.
import { routeBySession, SESSION_COOKIE } from '@/features/chat/routing';

/** Optimistic check by cookie presence only; pages validate the session (AD-002). */
export function proxy(request: NextRequest) {
  const target = routeBySession(
    request.nextUrl.pathname,
    // An empty value carries no session.
    Boolean(request.cookies.get(SESSION_COOKIE)?.value),
  );

  return target
    ? NextResponse.redirect(new URL(target, request.url))
    : NextResponse.next();
}

// /chat/stream (F2) must not go through the proxy.
export const config = { matcher: ['/', '/chat'] };
