import { makeMessage, me } from '../test-fixtures';
import { getValidSession } from '../session/get-valid-session';
import { getChatHub } from './chat-hub';
import { openChatStream } from './open-chat-stream';

vi.mock('../session/get-valid-session', () => ({ getValidSession: vi.fn() }));

const TOKEN = 'q1W2e3R4t5Y6u7I8o9P0a_S-d1F2g3H4j5K6l7Z8x9C';

function withSession() {
  vi.mocked(getValidSession).mockResolvedValue({
    session: { participantId: me.id, token: TOKEN },
    me,
    online: { items: [me], total: 1 },
  });
}

function streamRequest() {
  const abort = new AbortController();
  const request = new Request('http://web.test/chat/stream', {
    signal: abort.signal,
  });
  return { request, abort };
}

/** Reads the body in the background; `chunks` holds every decoded chunk so far. */
function collect(response: Response) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const state = { chunks: [] as string[], done: false };
  void (async () => {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) {
        state.done = true;
        return;
      }
      state.chunks.push(decoder.decode(value));
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
