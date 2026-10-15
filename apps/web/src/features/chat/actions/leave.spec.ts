import { http, HttpResponse } from 'msw';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { server, TEST_API_URL } from '../../../../test/msw/server';
import { leave } from './leave';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));
// Like Next, redirect() throws: anything after it never runs.
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

const PARTICIPANT_ID = 'a1b2c3d4-0000-4000-8000-000000000003';
const TOKEN = 'q1W2e3R4t5Y6u7I8o9P0a_S-d1F2g3H4j5K6l7Z8x9C';

function cookieJar(initial: Record<string, string>) {
  const jar = new Map(Object.entries(initial));
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) =>
      jar.has(name) ? { name, value: jar.get(name) } : undefined,
    delete: (name: string) => jar.delete(name),
  } as unknown as Awaited<ReturnType<typeof cookies>>);
  return jar;
}

/** Records every api request (method, path, token) and answers `reply`. */
function api(reply: () => Response) {
  const calls: { method: string; path: string; token: string | null }[] = [];
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

describe('leave', () => {
  beforeEach(() => {
    vi.mocked(redirect).mockClear();
  });

  it.each([
    ['204', () => new HttpResponse(null, { status: 204 })],
    ['401', () => new HttpResponse(null, { status: 401 })],
    ['500', () => new HttpResponse(null, { status: 500 })],
    ['falha de rede', () => HttpResponse.error()],
  ])(
    'api responde %s → chama o leave com o token, apaga o cookie e redireciona para /',
    async (_case, reply) => {
      const jar = cookieJar({
        chat_session: `${PARTICIPANT_ID}.${TOKEN}`,
        theme: 'dark',
      });
      const calls = api(reply);

      await expect(leave()).rejects.toThrow('NEXT_REDIRECT');

      expect(calls).toEqual([
        {
          method: 'POST',
          path: '/api/v1/chat/participants/a1b2c3d4-0000-4000-8000-000000000003/leave',
          token: 'q1W2e3R4t5Y6u7I8o9P0a_S-d1F2g3H4j5K6l7Z8x9C',
        },
      ]);
      expect([...jar.keys()]).toEqual(['theme']);
      expect(redirect).toHaveBeenCalledExactlyOnceWith('/');
    },
  );

  it.each([
    ['sem cookie', {}],
    ['cookie malformado', { chat_session: 'lixo' }],
  ])('%s → só redireciona para /, sem chamar a api', async (_case, initial) => {
    const jar = cookieJar({ ...initial, theme: 'dark' });
    const calls = api(() => new HttpResponse(null, { status: 204 }));

    await expect(leave()).rejects.toThrow('NEXT_REDIRECT');

    expect(calls).toEqual([]);
    expect([...jar.keys()]).toEqual(['theme']);
    expect(redirect).toHaveBeenCalledExactlyOnceWith('/');
  });
});
