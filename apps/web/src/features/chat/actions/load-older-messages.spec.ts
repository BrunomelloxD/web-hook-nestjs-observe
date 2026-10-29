import { http, HttpResponse } from 'msw';
import { cookies } from 'next/headers';
import { server, TEST_API_URL } from '../../../../test/msw/server';
import { ana, carlos, makeMessage, me } from '../test-fixtures';
import { loadOlderMessages } from './load-older-messages';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));

const TOKEN = 'q1W2e3R4t5Y6u7I8o9P0a_S-d1F2g3H4j5K6l7Z8x9C';
const older = [
  makeMessage({ seq: 950, content: 'mais antiga' }),
  makeMessage({ seq: 951, content: 'seguinte' }),
];

function withCookies(jar: Record<string, string>) {
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) =>
      name in jar ? { name, value: jar[name] } : undefined,
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

const withSession = () => withCookies({ chat_session: `${me.id}.${TOKEN}` });

/** Answers the online list and the messages page; records every request. */
function api({
  online = [ana, carlos, me],
  messages = () => HttpResponse.json({ items: older }),
}: {
  online?: (typeof me)[];
  messages?: () => Response;
} = {}) {
  const calls: string[] = [];
  server.use(
    http.get(`${TEST_API_URL}/api/v1/chat/participants/online`, () => {
      calls.push('GET /api/v1/chat/participants/online');
      return HttpResponse.json({ items: online, total: online.length });
    }),
    http.get(`${TEST_API_URL}/api/v1/chat/messages`, ({ request }) => {
      const url = new URL(request.url);
      calls.push(`GET ${url.pathname}?${url.searchParams}`);
      return messages();
    }),
  );
  return calls;
}

describe('loadOlderMessages', () => {
  it('sessão válida → GET /messages com before e limit=50, devolve { ok: true, items } em ordem de seq', async () => {
    withSession();
    const calls = api();

    await expect(loadOlderMessages(1000)).resolves.toEqual({
      ok: true,
      items: older,
    });
    expect(calls).toEqual([
      'GET /api/v1/chat/participants/online',
      'GET /api/v1/chat/messages?before=1000&limit=50',
    ]);
  });

  it.each([0, -1, 1.5])(
    'before = %s → { ok: false } sem chamar a api',
    async (before) => {
      withSession();
      const calls = api();

      await expect(loadOlderMessages(before)).resolves.toEqual({ ok: false });
      expect(calls).toEqual([]);
    },
  );

  it('sem cookie → { ok: false } sem chamar a api', async () => {
    withCookies({});
    const calls = api();

    await expect(loadOlderMessages(1000)).resolves.toEqual({ ok: false });
    expect(calls).toEqual([]);
  });

  it('cookie de quem não está online → { ok: false } sem buscar mensagens', async () => {
    withSession();
    const calls = api({ online: [ana, carlos] });

    await expect(loadOlderMessages(1000)).resolves.toEqual({ ok: false });
    expect(calls).toEqual(['GET /api/v1/chat/participants/online']);
  });

  it('500 nas mensagens → { ok: false }', async () => {
    withSession();
    api({ messages: () => new HttpResponse(null, { status: 500 }) });

    await expect(loadOlderMessages(1000)).resolves.toEqual({ ok: false });
  });
});
