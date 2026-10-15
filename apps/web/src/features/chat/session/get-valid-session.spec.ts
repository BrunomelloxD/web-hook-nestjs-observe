import { http, HttpResponse } from 'msw';
import { cookies } from 'next/headers';
import { server, TEST_API_URL } from '../../../../test/msw/server';
import { ana, carlos, me } from '../test-fixtures';
import { getValidSession } from './get-valid-session';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));

const onlineUrl = `${TEST_API_URL}/api/v1/chat/participants/online`;
const TOKEN = 'q1W2e3R4t5Y6u7I8o9P0a_S-d1F2g3H4j5K6l7Z8x9C';

function withCookies(jar: Record<string, string>) {
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) =>
      name in jar ? { name, value: jar[name] } : undefined,
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

/** Counts every request to the api, whatever the path. */
function onlineApi(items = [ana, carlos, me]) {
  const calls: string[] = [];
  server.use(
    http.all(`${TEST_API_URL}/*`, ({ request }) => {
      calls.push(`${request.method} ${new URL(request.url).pathname}`);
      return HttpResponse.json({ items, total: items.length });
    }),
  );
  return calls;
}

describe('getValidSession', () => {
  it('sem cookie → null, sem chamar a api', async () => {
    withCookies({});
    const calls = onlineApi();

    await expect(getValidSession()).resolves.toBeNull();
    expect(calls).toEqual([]);
  });

  it('cookie malformado → null, sem chamar a api', async () => {
    withCookies({ chat_session: 'sem-ponto' });
    const calls = onlineApi();

    await expect(getValidSession()).resolves.toBeNull();
    expect(calls).toEqual([]);
  });

  it('cookie de quem não está online → null', async () => {
    withCookies({ chat_session: `${me.id}.${TOKEN}` });
    const calls = onlineApi([ana, carlos]);

    await expect(getValidSession()).resolves.toBeNull();
    expect(calls).toEqual(['GET /api/v1/chat/participants/online']);
  });

  it('outro participante com o mesmo nome não conta como a sessão', async () => {
    withCookies({ chat_session: `${me.id}.${TOKEN}` });
    onlineApi([{ id: 'a1b2c3d4-0000-4000-8000-000000000009', name: me.name }]);

    await expect(getValidSession()).resolves.toBeNull();
  });

  it('online → { session, me, online } com uma chamada só', async () => {
    withCookies({ chat_session: `${me.id}.${TOKEN}` });
    const calls = onlineApi([ana, me, carlos]);

    const result = await getValidSession();

    expect(calls).toEqual(['GET /api/v1/chat/participants/online']);
    expect(result).toEqual({
      session: {
        participantId: 'a1b2c3d4-0000-4000-8000-000000000003',
        token: TOKEN,
      },
      me: { id: 'a1b2c3d4-0000-4000-8000-000000000003', name: 'Bruno' },
      online: { items: [ana, me, carlos], total: 3 },
    });
  });

  it('api fora do ar → lança (vai para o error.tsx)', async () => {
    withCookies({ chat_session: `${me.id}.${TOKEN}` });
    server.use(
      http.get(onlineUrl, () => HttpResponse.json({}, { status: 500 })),
    );

    await expect(getValidSession()).rejects.toThrow(
      'Falha ao carregar os participantes online',
    );
  });
});
