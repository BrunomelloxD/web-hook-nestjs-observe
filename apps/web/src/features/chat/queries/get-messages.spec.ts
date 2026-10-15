import { http, HttpResponse } from 'msw';
import { server, TEST_API_URL } from '../../../../test/msw/server';
import { makeConversation } from '../test-fixtures';
import { getMessages } from './get-messages';

const url = `${TEST_API_URL}/api/v1/chat/messages`;

/** Records each request's query string and answers with `items`. */
function captureQuery(items = makeConversation()) {
  const queries: URLSearchParams[] = [];
  server.use(
    http.get(url, ({ request }) => {
      queries.push(new URL(request.url).searchParams);
      return HttpResponse.json({ items });
    }),
  );
  return queries;
}

describe('getMessages', () => {
  it('manda limit e before na query string', async () => {
    const queries = captureQuery();

    await getMessages({ limit: 50, before: 1040 });

    expect(queries).toHaveLength(1);
    expect(Object.fromEntries(queries[0]!)).toEqual({
      limit: '50',
      before: '1040',
    });
  });

  it('manda limit e after na query string', async () => {
    const queries = captureQuery();

    await getMessages({ limit: 20, after: 7 });

    expect(Object.fromEntries(queries[0]!)).toEqual({
      limit: '20',
      after: '7',
    });
  });

  it('sem parâmetros não manda query string', async () => {
    const queries = captureQuery();

    await getMessages({});

    expect([...queries[0]!.keys()]).toEqual([]);
  });

  it('200 devolve os items da resposta, na ordem da api', async () => {
    const conversation = makeConversation();
    captureQuery(conversation);

    const messages = await getMessages({ limit: 50 });

    expect(messages).toEqual(conversation);
    expect(messages.map((m) => m.seq)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(messages[1]).toMatchObject({
      type: 'USER',
      content: 'Oi, pessoal! Alguém por aqui?',
      author: { name: 'Ana' },
    });
  });

  it('500 lança', async () => {
    server.use(http.get(url, () => HttpResponse.json({}, { status: 500 })));

    await expect(getMessages({ limit: 50 })).rejects.toThrow(
      'Falha ao carregar as mensagens',
    );
  });
});
