import { http, HttpResponse } from 'msw';
import { server, TEST_API_URL } from '../../../../test/msw/server';
import type { ChatMessage } from '../chat.types';
import { makeMessage, me } from '../test-fixtures';
import { getValidSession } from '../session/get-valid-session';
import { getChatHub } from './chat-hub';
import { openChatStream, parseLastEventId } from './open-chat-stream';

vi.mock('../session/get-valid-session', () => ({ getValidSession: vi.fn() }));

const TOKEN = 'q1W2e3R4t5Y6u7I8o9P0a_S-d1F2g3H4j5K6l7Z8x9C';

function withSession() {
  vi.mocked(getValidSession).mockResolvedValue({
    session: { participantId: me.id, token: TOKEN },
    me,
    online: { items: [me], total: 1 },
  });
}

function streamRequest(lastEventId?: string, search = '') {
  const abort = new AbortController();
  const request = new Request(`http://web.test/chat/stream${search}`, {
    signal: abort.signal,
    headers: lastEventId === undefined ? {} : { 'Last-Event-ID': lastEventId },
  });
  return { request, abort };
}

/** Reads the body in the background; `chunks` holds every decoded chunk so far. */
function collect(response: Response) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const state = {
    chunks: [] as string[],
    done: false,
    error: undefined as unknown,
  };
  void (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) {
          state.done = true;
          return;
        }
        state.chunks.push(decoder.decode(value));
      }
    } catch (error) {
      state.error = error;
    }
  })();
  return { state, reader };
}

const RETRY = 'retry: 3000\n\n';
const HEARTBEAT = ': heartbeat\n\n';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('openChatStream sem sessão válida', () => {
  it('responde 401 e não registra conexão no hub', async () => {
    vi.mocked(getValidSession).mockResolvedValue(null);
    const { request } = streamRequest();

    const response = await openChatStream(request);

    expect(response.status).toBe(401);
    expect(getChatHub().connectionCount()).toBe(0);
  });
});

describe('openChatStream com sessão válida', () => {
  it('responde 200 com os headers de SSE e registra a conexão do participante', async () => {
    withSession();
    const { request, abort } = streamRequest();

    const response = await openChatStream(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    expect(response.headers.get('cache-control')).toBe(
      'no-cache, no-transform',
    );
    expect(response.headers.get('x-accel-buffering')).toBe('no');
    expect(response.headers.get('connection')).toBe('keep-alive');
    expect(getChatHub().connectionCount(me.id)).toBe(1);
    abort.abort();
  });

  it('o primeiro chunk é retry: 3000', async () => {
    withSession();
    const { request, abort } = streamRequest();
    const { state } = collect(await openChatStream(request));

    await vi.advanceTimersByTimeAsync(0);

    expect(state.chunks).toEqual([RETRY]);
    abort.abort();
  });

  it('o hub escreve os eventos publicados no stream', async () => {
    withSession();
    const { request, abort } = streamRequest();
    const { state } = collect(await openChatStream(request));
    const message = makeMessage({ seq: 9 });

    getChatHub().publish({ type: 'message.created', data: message });
    await vi.advanceTimersByTimeAsync(0);

    expect(state.chunks).toEqual([
      RETRY,
      `id: 9\nevent: message\ndata: ${JSON.stringify(message)}\n\n`,
    ]);
    abort.abort();
  });

  it('escreve : heartbeat a cada 25 s, e nada 1 ms antes', async () => {
    withSession();
    const { request, abort } = streamRequest();
    const { state } = collect(await openChatStream(request));

    await vi.advanceTimersByTimeAsync(24_999);
    expect(state.chunks).toEqual([RETRY]);

    await vi.advanceTimersByTimeAsync(1);
    expect(state.chunks).toEqual([RETRY, HEARTBEAT]);

    await vi.advanceTimersByTimeAsync(24_999);
    expect(state.chunks).toEqual([RETRY, HEARTBEAT]);

    await vi.advanceTimersByTimeAsync(1);
    expect(state.chunks).toEqual([RETRY, HEARTBEAT, HEARTBEAT]);
    abort.abort();
  });
});

describe('openChatStream quando o navegador fecha a conexão', () => {
  it('abort → sai do hub, o stream termina e nada é escrito depois', async () => {
    withSession();
    const { request, abort } = streamRequest();
    const { state } = collect(await openChatStream(request));

    abort.abort();
    getChatHub().publish({ type: 'presence.changed', data: { online: 1 } });
    await vi.advanceTimersByTimeAsync(50_000);

    expect(getChatHub().connectionCount()).toBe(0);
    expect(state.chunks).toEqual([RETRY]);
    expect(state.done).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancel do stream → sai do hub e para o heartbeat; um abort depois não lança', async () => {
    withSession();
    const { request, abort } = streamRequest();
    const { state, reader } = collect(await openChatStream(request));
    await vi.advanceTimersByTimeAsync(0);

    await reader.cancel();
    abort.abort();
    await vi.advanceTimersByTimeAsync(50_000);

    expect(getChatHub().connectionCount()).toBe(0);
    expect(state.chunks).toEqual([RETRY]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('requisição já abortada ao abrir o stream → não fica no hub', async () => {
    withSession();
    const { request, abort } = streamRequest();
    abort.abort();

    const { state } = collect(await openChatStream(request));
    await vi.advanceTimersByTimeAsync(25_000);

    expect(getChatHub().connectionCount()).toBe(0);
    expect(state.chunks).toEqual([RETRY]);
    expect(state.done).toBe(true);
  });
});

describe('parseLastEventId', () => {
  it('aceita um inteiro positivo', () => {
    expect(parseLastEventId('1040')).toBe(1040);
  });

  it.each([['0'], ['-1'], ['abc'], ['1.5'], [''], ['99999999999999999999']])(
    'rejeita %j',
    (header) => {
      expect(parseLastEventId(header)).toBeNull();
    },
  );

  it('rejeita null (sem cabeçalho)', () => {
    expect(parseLastEventId(null)).toBeNull();
  });
});

const messagesUrl = `${TEST_API_URL}/api/v1/chat/messages`;
const chunkOf = (message: ChatMessage) =>
  `id: ${message.seq}\nevent: message\ndata: ${JSON.stringify(message)}\n\n`;

/** Messages with seq first..last, each with its own id. */
function messagesBetween(first: number, last: number): ChatMessage[] {
  return Array.from({ length: last - first + 1 }, (_, i) =>
    makeMessage({
      id: `m0000000-0000-4000-8000-${String(first + i).padStart(12, '0')}`,
      seq: first + i,
    }),
  );
}

/** Answers GET /messages like the api (seq > after, ascending, up to limit) and records each query. */
function messagesApi(
  stored: ChatMessage[],
  onRequest: (call: number) => void = () => {},
) {
  const queries: Record<string, string>[] = [];
  server.use(
    http.get(messagesUrl, ({ request }) => {
      const query = Object.fromEntries(new URL(request.url).searchParams);
      queries.push(query);
      onRequest(queries.length);
      const after = Number(query['after']);
      const limit = Number(query['limit']);
      return HttpResponse.json({
        items: stored.filter((m) => m.seq > after).slice(0, limit),
      });
    }),
  );
  return queries;
}

describe('openChatStream com Last-Event-ID', () => {
  it('250 mensagens perdidas → três páginas (100, 100, 50) escritas em ordem antes do evento ao vivo publicado durante a busca', async () => {
    withSession();
    const missed = messagesBetween(1041, 1290);
    const live = makeMessage({ id: 'live', seq: 1291 });
    const queries = messagesApi(missed, (call) => {
      if (call === 1) {
        getChatHub().publish({ type: 'message.created', data: live });
      }
    });
    const { request, abort } = streamRequest('1040');
    const { state } = collect(await openChatStream(request));

    await vi.waitFor(() => expect(state.chunks).toHaveLength(252));

    expect(queries).toEqual([
      { after: '1040', limit: '100' },
      { after: '1140', limit: '100' },
      { after: '1240', limit: '100' },
    ]);
    expect(state.chunks).toEqual([
      RETRY,
      ...missed.map(chunkOf),
      chunkOf(live),
    ]);
    abort.abort();
  });

  it('evento ao vivo com seq já recuperado não é escrito duas vezes', async () => {
    withSession();
    const missed = messagesBetween(1041, 1045);
    messagesApi(missed, () => {
      getChatHub().publish({ type: 'message.created', data: missed[4]! });
    });
    const { request, abort } = streamRequest('1040');
    const { state } = collect(await openChatStream(request));
    await vi.waitFor(() => expect(state.chunks).toHaveLength(6));

    const after = makeMessage({ id: 'after', seq: 1046 });
    getChatHub().publish({ type: 'message.created', data: after });
    await vi.advanceTimersByTimeAsync(0);

    expect(state.chunks).toEqual([
      RETRY,
      ...missed.map(chunkOf),
      chunkOf(after),
    ]);
    abort.abort();
  });

  it('busca com 500 → o stream termina com erro e a conexão sai do hub', async () => {
    withSession();
    server.use(
      http.get(messagesUrl, () => new HttpResponse(null, { status: 500 })),
    );
    const { request } = streamRequest('1040');
    const { state } = collect(await openChatStream(request));

    await vi.waitFor(() => expect(state.error).toBeDefined());

    expect(getChatHub().connectionCount(me.id)).toBe(0);
    expect(state.chunks).toEqual([RETRY]);
  });

  it('o navegador sai durante a busca → nada é escrito depois e o stream termina sem erro', async () => {
    withSession();
    const { request, abort } = streamRequest('1040');
    const queries = messagesApi(messagesBetween(1041, 1045), () => {
      abort.abort();
    });
    const { state } = collect(await openChatStream(request));

    await vi.waitFor(() => expect(state.done).toBe(true));
    await vi.advanceTimersByTimeAsync(0);

    expect(queries).toHaveLength(1);
    expect(state.chunks).toEqual([RETRY]);
    expect(state.error).toBeUndefined();
    expect(getChatHub().connectionCount(me.id)).toBe(0);
  });

  it('Last-Event-ID inválido → abre sem recuperação: nenhuma busca e eventos ao vivo direto', async () => {
    withSession();
    const queries = messagesApi(messagesBetween(1041, 1045));
    const { request, abort } = streamRequest('abc');
    const { state } = collect(await openChatStream(request));
    const live = makeMessage({ seq: 1046 });

    getChatHub().publish({ type: 'message.created', data: live });
    await vi.advanceTimersByTimeAsync(0);

    expect(queries).toEqual([]);
    expect(state.chunks).toEqual([RETRY, chunkOf(live)]);
    abort.abort();
  });
});

describe('openChatStream com after na query (RECON-01 AC7)', () => {
  it('sem Last-Event-ID e com ?after=1040 → escreve as mensagens depois de 1040, em ordem, antes do evento ao vivo publicado durante a busca', async () => {
    withSession();
    const missed = messagesBetween(1041, 1045);
    const live = makeMessage({ id: 'live', seq: 1046 });
    const queries = messagesApi(missed, () => {
      getChatHub().publish({ type: 'message.created', data: live });
    });
    const { request, abort } = streamRequest(undefined, '?after=1040');
    const { state } = collect(await openChatStream(request));

    await vi.waitFor(() => expect(state.chunks).toHaveLength(7));

    expect(queries).toEqual([{ after: '1040', limit: '100' }]);
    expect(state.chunks).toEqual([
      RETRY,
      ...missed.map(chunkOf),
      chunkOf(live),
    ]);
    abort.abort();
  });

  it('Last-Event-ID e ?after juntos → vale o Last-Event-ID (reconexão do EventSource com a mesma URL)', async () => {
    withSession();
    const stored = messagesBetween(1041, 1103);
    const queries = messagesApi(stored);
    const { request, abort } = streamRequest('1100', '?after=1040');
    const { state } = collect(await openChatStream(request));

    await vi.waitFor(() => expect(state.chunks).toHaveLength(4));

    expect(queries).toEqual([{ after: '1100', limit: '100' }]);
    expect(state.chunks).toEqual([RETRY, ...stored.slice(-3).map(chunkOf)]);
    abort.abort();
  });

  it.each([['?after=abc'], ['?after=0'], ['?after=-5'], ['?after=']])(
    'sem Last-Event-ID e com %s → abre sem recuperação: nenhuma busca e eventos ao vivo direto (RECON-01 AC3)',
    async (search) => {
      withSession();
      const queries = messagesApi(messagesBetween(1, 5));
      const { request, abort } = streamRequest(undefined, search);
      const { state } = collect(await openChatStream(request));
      const live = makeMessage({ seq: 6 });

      getChatHub().publish({ type: 'message.created', data: live });
      await vi.advanceTimersByTimeAsync(0);

      expect(queries).toEqual([]);
      expect(state.chunks).toEqual([RETRY, chunkOf(live)]);
      abort.abort();
    },
  );
});
