import { http, HttpResponse } from 'msw';
import { refresh } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { server, TEST_API_URL } from '../../../../test/msw/server';
import { notifyTyping } from './notify-typing';

vi.mock('next/cache', () => ({ refresh: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
// Like Next, redirect() throws: anything after it never runs.
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

const PARTICIPANT_ID = 'a1b2c3d4-0000-4000-8000-000000000003';
const TOKEN = 'q1W2e3R4t5Y6u7I8o9P0a_S-d1F2g3H4j5K6l7Z8x9C';

/** In-memory cookie jar with the methods the session module uses. */
function cookieJar(initial: Record<string, string>) {
  const jar = new Map(Object.entries(initial));
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) =>
      jar.has(name) ? { name, value: jar.get(name) } : undefined,
    delete: (name: string) => jar.delete(name),
  } as unknown as Awaited<ReturnType<typeof cookies>>);
  return jar;
}

function withSession() {
  return cookieJar({
    chat_session: `${PARTICIPANT_ID}.${TOKEN}`,
    theme: 'dark',
  });
}

type Call = { method: string; path: string; token: string | null };

/** Records every api request and answers `reply`. */
function api(reply: () => Response) {
  const calls: Call[] = [];
  server.use(
    http.all(`${TEST_API_URL}/*`, ({ request }) => {
      calls.push({
        method: request.method,
        path: new URL(request.url).pathname,
        token: request.headers.get('X-Participant-Token'),
      });
      return reply();
    }),
  );
  return calls;
}

describe('notifyTyping', () => {
  beforeEach(() => {
    vi.mocked(redirect).mockClear();
    vi.mocked(refresh).mockClear();
  });

  it('com sessão → POST /api/v1/chat/typing com o token no header', async () => {
    withSession();
    const calls = api(() => new HttpResponse(null, { status: 204 }));

    await expect(notifyTyping()).resolves.toBeUndefined();

    expect(calls).toEqual([
      {
        method: 'POST',
        path: '/api/v1/chat/typing',
        token: 'q1W2e3R4t5Y6u7I8o9P0a_S-d1F2g3H4j5K6l7Z8x9C',
      },
    ]);
  });

  it.each([
    ['401', () => new HttpResponse(null, { status: 401 })],
    ['500', () => new HttpResponse(null, { status: 500 })],
    ['falha de rede', () => HttpResponse.error()],
  ])(
    '%s → resolve sem lançar, sem refresh, sem redirect e sem mexer no cookie',
    async (_case, reply) => {
      const jar = withSession();
      const calls = api(reply);

      await expect(notifyTyping()).resolves.toBeUndefined();

      expect(calls).toHaveLength(1);
      expect(redirect).not.toHaveBeenCalled();
      expect(refresh).not.toHaveBeenCalled();
      expect(jar.get('chat_session')).toBe(`${PARTICIPANT_ID}.${TOKEN}`);
    },
  );

  it.each([
    ['sem cookie', {}],
    ['cookie malformado', { chat_session: 'lixo' }],
  ])('%s → não chama a api e não redireciona', async (_case, initial) => {
    cookieJar({ ...initial, theme: 'dark' });
    const calls = api(() => new HttpResponse(null, { status: 204 }));

    await expect(notifyTyping()).resolves.toBeUndefined();

    expect(calls).toEqual([]);
    expect(redirect).not.toHaveBeenCalled();
  });
});
