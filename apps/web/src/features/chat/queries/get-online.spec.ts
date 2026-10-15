import { http, HttpResponse } from 'msw';
import { server, TEST_API_URL } from '../../../../test/msw/server';
import { ana, carlos } from '../test-fixtures';
import { getOnline } from './get-online';

const url = `${TEST_API_URL}/api/v1/chat/participants/online`;

describe('getOnline', () => {
  it('200 devolve { items, total } da api', async () => {
    let method: string | undefined;
    server.use(
      http.all(url, ({ request }) => {
        method = request.method;
        return HttpResponse.json({ items: [ana, carlos], total: 2 });
      }),
    );

    const online = await getOnline();

    expect(method).toBe('GET');
    expect(online.total).toBe(2);
    expect(online.items).toEqual([
      { id: 'a1b2c3d4-0000-4000-8000-000000000001', name: 'Ana' },
      { id: 'a1b2c3d4-0000-4000-8000-000000000002', name: 'Carlos' },
    ]);
  });

  it('500 lança', async () => {
    server.use(http.get(url, () => HttpResponse.json({}, { status: 500 })));

    await expect(getOnline()).rejects.toThrow(
      'Falha ao carregar os participantes online',
    );
  });
});
