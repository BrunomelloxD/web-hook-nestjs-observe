import { WebhookHttpClient } from '../webhook-http-client.js';

const URL = 'http://localhost:4599/webhooks/chat';
const BODY =
  '{"type":"presence.changed","occurredAt":"2026-10-14T12:00:00.000Z","data":{"online":2}}';
const HEADERS = {
  'webhook-id': 'evt-1',
  'webhook-timestamp': '1760443200',
  'webhook-signature': 'v1,abc=',
  'content-type': 'application/json',
};

describe('WebhookHttpClient', () => {
  const client = new WebhookHttpClient();
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** Resolves (or rejects) the fetch after `ms` of fake time. */
  function respondAfter(ms: number, outcome: () => Response) {
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve, reject) =>
          setTimeout(() => {
            try {
              resolve(outcome());
            } catch (error) {
              reject(error);
            }
          }, ms),
        ),
    );
  }

  async function post() {
    const pending = client.post(URL, BODY, HEADERS);
    await vi.runAllTimersAsync();
    return pending;
  }

  it('faz POST na URL com o corpo e os headers recebidos, sem mudar nada', async () => {
    respondAfter(0, () => new Response(null, { status: 204 }));

    await post();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(URL);
    expect(init.method).toBe('POST');
    expect(init.body).toBe(BODY);
    expect(init.headers).toEqual(HEADERS);
  });

  it('usa um timeout de 5 s no AbortSignal passado ao fetch', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    respondAfter(0, () => new Response(null, { status: 204 }));

    await post();

    expect(timeout).toHaveBeenCalledWith(5000);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBe(timeout.mock.results[0].value);
  });

  it('204 → { status: 204, error: null } com a duração em ms', async () => {
    respondAfter(120, () => new Response(null, { status: 204 }));

    await expect(post()).resolves.toEqual({
      status: 204,
      durationMs: 120,
      error: null,
    });
  });

  it('500 → { status: 500 } sem lançar, com a duração em ms', async () => {
    respondAfter(45, () => new Response('boom', { status: 500 }));

    await expect(post()).resolves.toEqual({
      status: 500,
      durationMs: 45,
      error: null,
    });
  });

  it('erro de rede → { status: null, error: mensagem } sem lançar', async () => {
    respondAfter(7, () => {
      throw new TypeError('fetch failed');
    });

    await expect(post()).resolves.toEqual({
      status: null,
      durationMs: 7,
      error: 'fetch failed',
    });
  });

  it("timeout → { status: null, error: 'timeout' } sem lançar", async () => {
    respondAfter(5000, () => {
      throw new DOMException(
        'The operation was aborted due to timeout',
        'TimeoutError',
      );
    });

    await expect(post()).resolves.toEqual({
      status: null,
      durationMs: 5000,
      error: 'timeout',
    });
  });

  it('um AbortError que não é timeout fica com a própria mensagem', async () => {
    respondAfter(3, () => {
      throw new DOMException('This operation was aborted', 'AbortError');
    });

    await expect(post()).resolves.toEqual({
      status: null,
      durationMs: 3,
      error: 'This operation was aborted',
    });
  });
});
