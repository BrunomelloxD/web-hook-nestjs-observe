import { randomUUID } from 'node:crypto';
import { server } from '../../../../test/msw/server';
import { signTestWebhook } from '../../../../test/webhooks';
import { makeMessage } from '../test-fixtures';
import { getChatHub } from './chat-hub';
import { handleChatWebhook } from './handle-chat-webhook';

const message = makeMessage({ seq: 42, content: 'conteúdo-secreto' });
const messageBody = JSON.stringify({
  type: 'message.created',
  occurredAt: '2026-10-15T12:00:00.000Z',
  data: message,
});
const messageChunk = `id: 42\nevent: message\ndata: ${JSON.stringify(message)}\n\n`;

const OTHER_SECRET = 'whsec_AAECAwQFBgcICQoLDA0ODw==';

function webhookRequest(
  body: string,
  headers: Record<string, string>,
): Request {
  return new Request('http://web.test/webhooks/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  });
}

/** Signs `body` with a fresh id (the receiver remembers ids process-wide). */
function signed(
  body: string,
  options: { id?: string; timestamp?: number; secret?: string } = {},
) {
  return signTestWebhook({ id: `msg_${randomUUID()}`, body, ...options });
}

let chunks: string[];
let unsubscribe: () => void;
let warn: ReturnType<typeof vi.spyOn>;
let networkRequests: string[];

beforeEach(() => {
  chunks = [];
  unsubscribe = getChatHub().subscribe({
    participantId: 'a1b2c3d4-0000-4000-8000-000000000001',
    token: 'token',
    write: (chunk) => {
      chunks.push(chunk);
    },
  }).unsubscribe;
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  networkRequests = [];
  server.events.on('request:start', ({ request }) => {
    networkRequests.push(request.url);
  });
});

afterEach(() => {
  unsubscribe();
  warn.mockRestore();
  server.events.removeAllListeners();
});

describe('handleChatWebhook: webhook válido e novo', () => {
  it('message.created → 204 e o hub escreve event: message com id igual ao seq', async () => {
    const response = await handleChatWebhook(
      webhookRequest(messageBody, signed(messageBody)),
    );

    expect(response.status).toBe(204);
    expect(chunks).toEqual([messageChunk]);
    expect(networkRequests).toEqual([]);
  });

  it('presence.changed → 204 e o hub escreve event: presence', async () => {
    const body = JSON.stringify({
      type: 'presence.changed',
      occurredAt: '2026-10-15T12:00:00.000Z',
      data: { online: 2 },
    });

    const response = await handleChatWebhook(
      webhookRequest(body, signed(body)),
    );

    expect(response.status).toBe(204);
    expect(chunks).toEqual(['event: presence\ndata: {"online":2}\n\n']);
  });

  it('typing.started → 204 e o hub escreve event: typing com o data, sem id:', async () => {
    const data = {
      participant: { id: '550e8400-e29b-41d4-a716-446655440000', name: 'Ana' },
    };
    const body = JSON.stringify({
      type: 'typing.started',
      occurredAt: '2026-10-15T12:00:00.000Z',
      data,
    });

    const response = await handleChatWebhook(
      webhookRequest(body, signed(body)),
    );

    expect(response.status).toBe(204);
    expect(chunks).toEqual([
      `event: typing\ndata: ${JSON.stringify(data)}\n\n`,
    ]);
  });

  it('verifica os bytes crus: JSON com espaços fora do formato do JSON.stringify passa', async () => {
    const body = `{ "type": "presence.changed",\n  "occurredAt": "2026-10-15T12:00:00.000Z", "data": { "online": 5 } }`;

    const response = await handleChatWebhook(
      webhookRequest(body, signed(body)),
    );

    expect(response.status).toBe(204);
    expect(chunks).toEqual(['event: presence\ndata: {"online":5}\n\n']);
  });

  it('sem nenhuma conexão aberta → 204 e o evento é descartado', async () => {
    unsubscribe();
    expect(getChatHub().connectionCount()).toBe(0);

    const response = await handleChatWebhook(
      webhookRequest(messageBody, signed(messageBody)),
    );

    expect(response.status).toBe(204);
    expect(chunks).toEqual([]);
  });
});

describe('handleChatWebhook: id repetido', () => {
  it('o mesmo webhook-id duas vezes → 204 nas duas, publicado uma vez só', async () => {
    const headers = signed(messageBody);

    const first = await handleChatWebhook(webhookRequest(messageBody, headers));
    const second = await handleChatWebhook(
      webhookRequest(messageBody, headers),
    );

    expect(first.status).toBe(204);
    expect(second.status).toBe(204);
    expect(chunks).toEqual([messageChunk]);
  });
});

describe('handleChatWebhook: recusado com 401, sem publicar', () => {
  const now = () => Math.floor(Date.now() / 1000);

  it.each([
    [
      'assinatura ausente',
      () => {
        const { 'webhook-signature': _, ...headers } = signed(messageBody);
        return { body: messageBody, headers, reason: 'missing' };
      },
    ],
    [
      'assinatura de outro segredo',
      () => ({
        body: messageBody,
        headers: signed(messageBody, { secret: OTHER_SECRET }),
        reason: 'signature',
      }),
    ],
    [
      'timestamp 301 s no passado',
      () => ({
        body: messageBody,
        headers: signed(messageBody, { timestamp: now() - 301 }),
        reason: 'timestamp',
      }),
    ],
    [
      'corpo com um byte a mais (espaço)',
      () => ({
        body: `${messageBody} `,
        headers: signed(messageBody),
        reason: 'signature',
      }),
    ],
  ])('%s', async (_, build) => {
    const { body, headers, reason } = build();

    const response = await handleChatWebhook(webhookRequest(body, headers));

    expect(response.status).toBe(401);
    expect(chunks).toEqual([]);
    expect(warn).toHaveBeenCalledExactlyOnceWith('Webhook recusado', {
      reason,
      webhookId: headers['webhook-id'],
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('conteúdo-secreto');
  });

  it('assinatura recusada não marca o id como processado', async () => {
    const headers = signed(messageBody);
    await handleChatWebhook(
      webhookRequest(messageBody, { ...headers, 'webhook-signature': 'v1,x' }),
    );

    const response = await handleChatWebhook(
      webhookRequest(messageBody, headers),
    );

    expect(response.status).toBe(204);
    expect(chunks).toEqual([messageChunk]);
  });
});

describe('handleChatWebhook: fora do envelope → 400, sem publicar', () => {
  it.each([
    ['corpo que não é JSON', 'não é json'],
    [
      'tipo desconhecido',
      // typing.started became a known type in F4; a stop event is not one.
      JSON.stringify({
        type: 'typing.stopped',
        occurredAt: '2026-10-15T12:00:00.000Z',
        data: {},
      }),
    ],
    [
      'data sem seq',
      JSON.stringify({
        type: 'message.created',
        occurredAt: '2026-10-15T12:00:00.000Z',
        data: { ...message, seq: undefined },
      }),
    ],
  ])('%s', async (_, body) => {
    const response = await handleChatWebhook(
      webhookRequest(body, signed(body)),
    );

    expect(response.status).toBe(400);
    expect(chunks).toEqual([]);
  });
});
