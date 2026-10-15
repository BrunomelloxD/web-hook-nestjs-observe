import { http, HttpResponse } from 'msw';
import { server, TEST_API_URL } from '../../test/msw/server';
import { getApi } from './api';

describe('getApi', () => {
  it('cria o client apontando para a API_URL', async () => {
    server.use(
      http.get(`${TEST_API_URL}/health`, () =>
        HttpResponse.json({ status: 'ok' }),
      ),
    );

    const { data } = await getApi().GET('/health');

    expect(data).toEqual({ status: 'ok' });
  });
});
