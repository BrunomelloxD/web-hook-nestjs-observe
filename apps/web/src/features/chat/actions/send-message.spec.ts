import { http, HttpResponse } from 'msw';
import { refresh } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { server, TEST_API_URL } from '../../../../test/msw/server';
import { sendMessage } from './send-message';

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
const CLIENT_ID = '3f0c9a4e-8b1d-4c2a-9e5f-7a6b5c4d3e2f';

const created = {
  id: 'm0000000-0000-4000-8000-000000000042',
  seq: 42,
  type: 'USER',
  content: 'olá',
  clientId: CLIENT_ID,
  author: { id: PARTICIPANT_ID, name: 'Bruno' },
  createdAt: '2026-10-14T17:40:00.000Z',
};

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

type Call = {
  method: string;
  path: string;
  token: string | null;
  body: unknown;
};

/** Records every api request and answers `reply`. */
function api(reply: () => Response) {
  const calls: Call[] = [];
  server.use(
    http.all(`${TEST_API_URL}/*`, async ({ request }) => {
      calls.push({
        method: request.method,
        path: new URL(request.url).pathname,
        token: request.headers.get('X-Participant-Token'),
        body: await request.json().catch(() => undefined),
      });
      return reply();
    }),
  );
  return calls;
}

describe('sendMessage', () => {
  beforeEach(() => {
    vi.mocked(redirect).mockClear();
    vi.mocked(refresh).mockClear();
  });

  it('201 → manda o token no header e { content, clientId } no corpo, devolve a mensagem e não chama refresh() (a própria mensagem chega pelo SSE)', async () => {
    const jar = withSession();
    const calls = api(() => HttpResponse.json(created, { status: 201 }));

    const result = await sendMessage({
      content: '  olá  ',
      clientId: CLIENT_ID,
    });

    expect(calls).toEqual([
      {
        method: 'POST',
        path: '/api/v1/chat/messages',
        token: 'q1W2e3R4t5Y6u7I8o9P0a_S-d1F2g3H4j5K6l7Z8x9C',
        body: { content: 'olá', clientId: CLIENT_ID },
      },
    ]);
    expect(result).toEqual({
      ok: true,
      message: {
        id: 'm0000000-0000-4000-8000-000000000042',
        seq: 42,
        type: 'USER',
        content: 'olá',
        clientId: CLIENT_ID,
        author: { id: PARTICIPANT_ID, name: 'Bruno' },
        createdAt: '2026-10-14T17:40:00.000Z',
      },
    });
    expect(refresh).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
    expect(jar.get('chat_session')).toBe(`${PARTICIPANT_ID}.${TOKEN}`);
  });

  it('401 → apaga o cookie chat_session e redireciona para /', async () => {
    const jar = withSession();
    const calls = api(() => new HttpResponse(null, { status: 401 }));

    await expect(
      sendMessage({ content: 'olá', clientId: CLIENT_ID }),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(calls).toHaveLength(1);
    expect([...jar.keys()]).toEqual(['theme']);
    expect(redirect).toHaveBeenCalledExactlyOnceWith('/');
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each([
    ['sem cookie', {}],
    ['cookie malformado', { chat_session: 'lixo' }],
  ])('%s → redireciona para / sem chamar a api', async (_case, initial) => {
    const jar = cookieJar({ ...initial, theme: 'dark' });
    const calls = api(() => HttpResponse.json(created, { status: 201 }));

    await expect(
      sendMessage({ content: 'olá', clientId: CLIENT_ID }),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(calls).toEqual([]);
    expect([...jar.keys()]).toEqual(['theme']);
    expect(redirect).toHaveBeenCalledExactlyOnceWith('/');
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each([
    ['conteúdo vazio depois do trim', { content: '   ', clientId: CLIENT_ID }],
    [
      'conteúdo com 1001 caracteres',
      { content: 'a'.repeat(1001), clientId: CLIENT_ID },
    ],
    ['clientId que não é uuid', { content: 'olá', clientId: 'abc' }],
  ])(
    '%s → { ok: false, reason: "invalid" } sem chamar a api',
    async (_case, input) => {
      const jar = withSession();
      const calls = api(() => HttpResponse.json(created, { status: 201 }));

      await expect(sendMessage(input)).resolves.toEqual({
        ok: false,
        reason: 'invalid',
      });
      expect(calls).toEqual([]);
      expect(refresh).not.toHaveBeenCalled();
      expect(jar.has('chat_session')).toBe(true);
    },
  );

  it('500 → { ok: false, reason: "unexpected" }, mantém a sessão e não chama refresh()', async () => {
    const jar = withSession();
    api(() => new HttpResponse(null, { status: 500 }));

    await expect(
      sendMessage({ content: 'olá', clientId: CLIENT_ID }),
    ).resolves.toEqual({ ok: false, reason: 'unexpected' });
    expect(refresh).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
    expect(jar.get('chat_session')).toBe(`${PARTICIPANT_ID}.${TOKEN}`);
  });

  it('429 com Retry-After: 4 → { ok: false, reason: "rate_limited", retryAfter: 4 }, mantém a sessão e não chama refresh()', async () => {
    const jar = withSession();
    const calls = api(
      () =>
        new HttpResponse(null, {
          status: 429,
          headers: { 'Retry-After': '4' },
        }),
    );

    await expect(
      sendMessage({ content: 'olá', clientId: CLIENT_ID }),
    ).resolves.toEqual({ ok: false, reason: 'rate_limited', retryAfter: 4 });
    expect(calls).toHaveLength(1);
    expect(refresh).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
    expect(jar.get('chat_session')).toBe(`${PARTICIPANT_ID}.${TOKEN}`);
  });
});
