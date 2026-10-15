import { cookies } from 'next/headers';
import {
  clearSession,
  decodeSession,
  encodeSession,
  readSession,
  writeSession,
} from './session-cookie';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));

const PARTICIPANT_ID = 'a1b2c3d4-0000-4000-8000-000000000001';
// 43 base64url characters, like the api's token.
const TOKEN = 'q1W2e3R4t5Y6u7I8o9P0a_S-d1F2g3H4j5K6l7Z8x9C';
const VALUE = `${PARTICIPANT_ID}.${TOKEN}`;

/** In-memory cookie store with the methods the module uses. */
function fakeStore(initial: Record<string, string> = {}) {
  const jar = new Map(Object.entries(initial));
  const store = {
    jar,
    get: vi.fn((name: string) =>
      jar.has(name) ? { name, value: jar.get(name) } : undefined,
    ),
    set: vi.fn(
      (name: string, value: string, _options?: Record<string, unknown>) => {
        jar.set(name, value);
      },
    ),
    delete: vi.fn((name: string) => {
      jar.delete(name);
    }),
  };
  vi.mocked(cookies).mockResolvedValue(
    store as unknown as Awaited<ReturnType<typeof cookies>>,
  );
  return store;
}

describe('encodeSession / decodeSession', () => {
  it('grava "<uuid>.<token>" e lê de volta a mesma sessão', () => {
    const session = { participantId: PARTICIPANT_ID, token: TOKEN };

    expect(encodeSession(session)).toBe(VALUE);
    expect(decodeSession(encodeSession(session))).toEqual(session);
  });

  it.each([
    ['vazio', ''],
    ['ausente', undefined],
    ['sem ponto', `${PARTICIPANT_ID}${TOKEN}`],
    ['uuid inválido', `not-a-uuid.${TOKEN}`],
    ['uuid sem um caractere', `${PARTICIPANT_ID.slice(1)}.${TOKEN}`],
    ['token vazio', `${PARTICIPANT_ID}.`],
    ['id vazio', `.${TOKEN}`],
    ['dois pontos', `${PARTICIPANT_ID}.${TOKEN}.extra`],
    ['token fora do base64url', `${PARTICIPANT_ID}.abc def`],
  ])('valor malformado (%s) → null', (_case, value) => {
    expect(decodeSession(value)).toBeNull();
  });
});

describe('readSession', () => {
  it('lê a sessão do cookie chat_session', async () => {
    fakeStore({ chat_session: VALUE });

    await expect(readSession()).resolves.toEqual({
      participantId: PARTICIPANT_ID,
      token: TOKEN,
    });
  });

  it('sem o cookie → null', async () => {
    fakeStore();

    await expect(readSession()).resolves.toBeNull();
  });

  it('cookie de nome parecido não conta como sessão', async () => {
    fakeStore({ chat_session_old: VALUE, session: VALUE, Chat_Session: VALUE });

    await expect(readSession()).resolves.toBeNull();
  });

  it('cookie malformado → null', async () => {
    fakeStore({ chat_session: 'lixo' });

    await expect(readSession()).resolves.toBeNull();
  });
});

describe('writeSession', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('grava o cookie chat_session com os atributos exatos, sem maxAge/expires', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const store = fakeStore();

    await writeSession({ participantId: PARTICIPANT_ID, token: TOKEN });

    expect(store.set).toHaveBeenCalledOnce();
    const [name, value, options] = store.set.mock.calls[0]!;
    expect(name).toBe('chat_session');
    expect(value).toBe(VALUE);
    expect(options).toStrictEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
    });
    expect(options).not.toHaveProperty('maxAge');
    expect(options).not.toHaveProperty('expires');
  });

  it.each([
    ['production', true],
    ['development', false],
    ['test', false],
  ])('NODE_ENV=%s → secure %s', async (env, secure) => {
    vi.stubEnv('NODE_ENV', env);
    const store = fakeStore();

    await writeSession({ participantId: PARTICIPANT_ID, token: TOKEN });

    expect(store.set.mock.calls[0]?.[2]).toMatchObject({ secure });
  });
});

describe('clearSession', () => {
  it('apaga só o cookie chat_session', async () => {
    const store = fakeStore({ chat_session: VALUE, theme: 'dark' });

    await clearSession();

    expect(store.delete).toHaveBeenCalledWith('chat_session');
    expect([...store.jar.keys()]).toEqual(['theme']);
  });
});
