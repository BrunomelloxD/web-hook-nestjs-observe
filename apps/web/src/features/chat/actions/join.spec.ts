import { http, HttpResponse } from 'msw';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { server, TEST_API_URL } from '../../../../test/msw/server';
import { initialJoinFormState } from '../schemas/join-form.schema';
import { join } from './join';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));
// Like Next, redirect() throws: anything after it never runs.
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

const PARTICIPANT_ID = 'a1b2c3d4-0000-4000-8000-000000000007';
const TOKEN = 'q1W2e3R4t5Y6u7I8o9P0a_S-d1F2g3H4j5K6l7Z8x9C';
const GENERAL_ERROR = 'Não foi possível entrar no chat. Tente de novo.';

function form(name: string) {
  const formData = new FormData();
  formData.set('name', name);
  return formData;
}

function fakeCookies() {
  const set = vi.fn();
  vi.mocked(cookies).mockResolvedValue({ set } as unknown as Awaited<
    ReturnType<typeof cookies>
  >);
  return set;
}

/** Records every api request (method, path, JSON body) and answers `reply`. */
function api(reply: () => Response) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  server.use(
    http.all(`${TEST_API_URL}/*`, async ({ request }) => {
      calls.push({
        method: request.method,
        path: new URL(request.url).pathname,
        body: await request.json().catch(() => undefined),
      });
      return reply();
    }),
  );
  return calls;
}

describe('join', () => {
  beforeEach(() => {
    vi.mocked(redirect).mockClear();
  });

  it.each([
    ['curto demais', 'A'],
    ['curto demais depois do trim', ' A '],
    ['longo demais', 'a'.repeat(21)],
    ['com caractere proibido', 'Ana!'],
    ['vazio', ''],
  ])(
    'nome %s → erro no campo, sem chamar a api nem gravar cookie',
    async (_case, name) => {
      const set = fakeCookies();
      const calls = api(() => HttpResponse.json({}, { status: 201 }));

      const state = await join(initialJoinFormState, form(name));

      expect(state).toEqual({
        status: 'error',
        message:
          'O nome deve ter de 2 a 20 caracteres: letras, números, espaço, ".", "_" ou "-".',
        values: { name },
      });
      expect(calls).toEqual([]);
      expect(set).not.toHaveBeenCalled();
      expect(redirect).not.toHaveBeenCalled();
    },
  );

  it('409 → "Esse nome já está em uso na sala." no campo, sem cookie', async () => {
    const set = fakeCookies();
    api(() => new HttpResponse(null, { status: 409 }));

    const state = await join(initialJoinFormState, form('ana'));

    expect(state).toEqual({
      status: 'error',
      message: 'Esse nome já está em uso na sala.',
      values: { name: 'ana' },
    });
    expect(set).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it.each([400, 500])(
    '%i → mensagem geral, sem cookie nem redirect',
    async (status) => {
      const set = fakeCookies();
      api(() => new HttpResponse(null, { status }));

      const state = await join(initialJoinFormState, form('Ana'));

      expect(state).toEqual({
        status: 'error',
        message: GENERAL_ERROR,
        values: { name: 'Ana' },
      });
      expect(set).not.toHaveBeenCalled();
      expect(redirect).not.toHaveBeenCalled();
    },
  );

  it('201 → envia o nome com trim, grava o cookie com id e token e redireciona para /chat', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const set = fakeCookies();
    const calls = api(() =>
      HttpResponse.json(
        {
          id: PARTICIPANT_ID,
          name: 'Ana Maria',
          token: TOKEN,
          joinedAt: '2026-10-14T17:00:00.000Z',
        },
        { status: 201 },
      ),
    );

    await expect(
      join(initialJoinFormState, form('  Ana Maria  ')),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(calls).toEqual([
      {
        method: 'POST',
        path: '/api/v1/chat/participants',
        body: { name: 'Ana Maria' },
      },
    ]);
    expect(set).toHaveBeenCalledExactlyOnceWith(
      'chat_session',
      `${PARTICIPANT_ID}.${TOKEN}`,
      { httpOnly: true, sameSite: 'lax', secure: false, path: '/' },
    );
    expect(redirect).toHaveBeenCalledExactlyOnceWith('/chat');
    vi.unstubAllEnvs();
  });
});
