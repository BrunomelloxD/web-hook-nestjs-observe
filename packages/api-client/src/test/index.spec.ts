import { createApiClient } from '../index.js';

function fakeFetch() {
  return vi.fn(async (_request: Request) =>
    Response.json(
      { status: 'ok', info: {}, error: {}, details: {} },
      {
        status: 200,
      },
    ),
  );
}

describe('createApiClient', () => {
  it('chama a api na baseUrl e devolve a resposta tipada', async () => {
    const fetch = fakeFetch();
    const api = createApiClient({ baseUrl: 'http://api.test', fetch });

    const { data } = await api.GET('/health');

    const request = fetch.mock.calls[0]![0];
    expect(request.url).toBe('http://api.test/health');
    expect(data?.status).toBe('ok');
  });

  it('envia o token como Bearer quando informado', async () => {
    const fetch = fakeFetch();
    const api = createApiClient({
      baseUrl: 'http://api.test',
      token: 'abc',
      fetch,
    });

    await api.GET('/health');

    expect(fetch.mock.calls[0]![0].headers.get('authorization')).toBe(
      'Bearer abc',
    );
  });

  it('não envia Authorization sem token', async () => {
    const fetch = fakeFetch();
    const api = createApiClient({ baseUrl: 'http://api.test', fetch });

    await api.GET('/health');

    expect(fetch.mock.calls[0]![0].headers.has('authorization')).toBe(false);
  });
});
