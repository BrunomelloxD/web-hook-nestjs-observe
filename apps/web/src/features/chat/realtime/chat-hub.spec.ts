import { ana, carlos, makeMessage } from '../test-fixtures';
import { ChatHub, getChatHub, type HubConnection } from './chat-hub';

function connection(participantId = ana.id) {
  const chunks: string[] = [];
  const conn: HubConnection = {
    participantId,
    token: 'token',
    write: (chunk) => {
      chunks.push(chunk);
    },
  };
  return { conn, chunks };
}

function brokenConnection(participantId = ana.id) {
  const write = vi.fn(() => {
    throw new TypeError('Invalid state: Controller is already closed');
  });
  const conn: HubConnection = { participantId, token: 'token', write };
  return { conn, write };
}

const message = makeMessage({ seq: 7, content: 'oi' });
const messageChunk = `id: 7\nevent: message\ndata: ${JSON.stringify(message)}\n\n`;

describe('ChatHub.publish', () => {
  it('message.created → mesmo chunk em todas as conexões, com id igual ao seq', () => {
    const hub = new ChatHub();
    const a = connection(ana.id);
    const b = connection(carlos.id);
    hub.subscribe(a.conn);
    hub.subscribe(b.conn);

    hub.publish({ type: 'message.created', data: message });

    expect(a.chunks).toEqual([messageChunk]);
    expect(b.chunks).toEqual([messageChunk]);
  });

  it('presence.changed → event: presence com {"online":N}, sem id:', () => {
    const hub = new ChatHub();
    const a = connection();
    hub.subscribe(a.conn);

    hub.publish({ type: 'presence.changed', data: { online: 3 } });

    expect(a.chunks).toEqual(['event: presence\ndata: {"online":3}\n\n']);
  });

  it('conexão cujo write lança sai do hub; a outra continua recebendo', () => {
    const hub = new ChatHub();
    const broken = brokenConnection(ana.id);
    const ok = connection(carlos.id);
    hub.subscribe(broken.conn);
    hub.subscribe(ok.conn);

    hub.publish({ type: 'message.created', data: message });
    hub.publish({ type: 'presence.changed', data: { online: 1 } });

    expect(ok.chunks).toEqual([
      messageChunk,
      'event: presence\ndata: {"online":1}\n\n',
    ]);
    expect(broken.write).toHaveBeenCalledOnce();
    expect(hub.connectionCount()).toBe(1);
    expect(hub.connectionCount(ana.id)).toBe(0);
  });
});

describe('ChatHub.subscribe', () => {
  it('unsubscribe remove a conexão: nada é escrito depois', () => {
    const hub = new ChatHub();
    const a = connection();
    const unsubscribe = hub.subscribe(a.conn);

    unsubscribe();
    hub.publish({ type: 'message.created', data: message });

    expect(a.chunks).toEqual([]);
    expect(hub.connectionCount()).toBe(0);
  });
});

describe('ChatHub.connectionCount', () => {
  it('conta todas ou só as de um participante', () => {
    const hub = new ChatHub();
    hub.subscribe(connection(ana.id).conn);
    hub.subscribe(connection(ana.id).conn);
    hub.subscribe(connection(carlos.id).conn);

    expect(hub.connectionCount()).toBe(3);
    expect(hub.connectionCount(ana.id)).toBe(2);
    expect(hub.connectionCount(carlos.id)).toBe(1);
    expect(hub.connectionCount('a1b2c3d4-0000-4000-8000-000000000099')).toBe(0);
  });
});

describe('getChatHub', () => {
  it('devolve a mesma instância, guardada em globalThis', () => {
    const first = getChatHub();

    expect(first).toBeInstanceOf(ChatHub);
    expect(getChatHub()).toBe(first);
    expect(
      (globalThis as Record<symbol, unknown>)[Symbol.for('web-hook.chat-hub')],
    ).toBe(first);
  });

  it('a instância sobrevive a um novo import do módulo', async () => {
    const first = getChatHub();
    vi.resetModules();

    const reloaded = await import('./chat-hub');

    expect(reloaded.getChatHub()).toBe(first);
  });
});
