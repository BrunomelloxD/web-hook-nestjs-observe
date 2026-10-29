import { ana, carlos, makeMessage } from '../test-fixtures';
import { leaveParticipant } from '../session/leave-participant';
import { ChatHub, getChatHub, type HubConnection } from './chat-hub';

vi.mock('../session/leave-participant', () => ({
  leaveParticipant: vi.fn(() => Promise.resolve('left')),
}));

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

/** Hub whose away callback only records the calls. */
function newHub(onAway = vi.fn(() => Promise.resolve())) {
  return { hub: new ChatHub({ onAway }), onAway };
}

const message = makeMessage({ seq: 7, content: 'oi' });
const messageChunk = `id: 7\nevent: message\ndata: ${JSON.stringify(message)}\n\n`;

describe('ChatHub.publish', () => {
  it('message.created → mesmo chunk em todas as conexões, com id igual ao seq', () => {
    const { hub } = newHub();
    const a = connection(ana.id);
    const b = connection(carlos.id);
    hub.subscribe(a.conn);
    hub.subscribe(b.conn);

    hub.publish({ type: 'message.created', data: message });

    expect(a.chunks).toEqual([messageChunk]);
    expect(b.chunks).toEqual([messageChunk]);
  });

  it('presence.changed → event: presence com {"online":N}, sem id:', () => {
    const { hub } = newHub();
    const a = connection();
    hub.subscribe(a.conn);

    hub.publish({ type: 'presence.changed', data: { online: 3 } });

    expect(a.chunks).toEqual(['event: presence\ndata: {"online":3}\n\n']);
  });

  it('typing.started → event: typing com o data do webhook, sem id:', () => {
    const { hub } = newHub();
    const a = connection(ana.id);
    const b = connection(carlos.id);
    hub.subscribe(a.conn);
    hub.subscribe(b.conn);

    hub.publish({
      type: 'typing.started',
      data: { participant: { id: carlos.id, name: carlos.name } },
    });

    const chunk = `event: typing\ndata: {"participant":{"id":"${carlos.id}","name":"${carlos.name}"}}\n\n`;
    expect(a.chunks).toEqual([chunk]);
    expect(b.chunks).toEqual([chunk]);
  });

  it('conexão cujo write lança sai do hub; a outra continua recebendo', () => {
    const { hub } = newHub();
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
    const { hub } = newHub();
    const a = connection();
    const { unsubscribe } = hub.subscribe(a.conn);

    unsubscribe();
    hub.publish({ type: 'message.created', data: message });

    expect(a.chunks).toEqual([]);
    expect(hub.connectionCount()).toBe(0);
  });
});

describe('ChatHub.subscribe com recovering', () => {
  const chunkOf = (seq: number) => {
    const data = makeMessage({ seq });
    return `id: ${seq}\nevent: message\ndata: ${JSON.stringify(data)}\n\n`;
  };
  const publishMessage = (hub: ChatHub, seq: number) => {
    hub.publish({ type: 'message.created', data: makeMessage({ seq }) });
  };

  it('durante a recuperação nada é escrito; flush(1045) escreve só o 1046, na ordem com o presence', () => {
    const { hub } = newHub();
    const a = connection();
    const { flush } = hub.subscribe(a.conn, { recovering: true });

    publishMessage(hub, 1044);
    publishMessage(hub, 1045);
    hub.publish({ type: 'presence.changed', data: { online: 2 } });
    publishMessage(hub, 1046);
    expect(a.chunks).toEqual([]);

    flush(1045);

    expect(a.chunks).toEqual([
      'event: presence\ndata: {"online":2}\n\n',
      chunkOf(1046),
    ]);
  });

  it('dois presence no buffer viram um só, o último', () => {
    const { hub } = newHub();
    const a = connection();
    const { flush } = hub.subscribe(a.conn, { recovering: true });

    hub.publish({ type: 'presence.changed', data: { online: 2 } });
    publishMessage(hub, 1046);
    hub.publish({ type: 'presence.changed', data: { online: 3 } });
    flush(1045);

    expect(a.chunks).toEqual([
      chunkOf(1046),
      'event: presence\ndata: {"online":3}\n\n',
    ]);
  });

  it('typing durante a recuperação não entra no flush; depois do flush chega na hora', () => {
    const { hub } = newHub();
    const a = connection();
    const { flush } = hub.subscribe(a.conn, { recovering: true });
    const typing = {
      type: 'typing.started',
      data: { participant: { id: carlos.id, name: carlos.name } },
    } as const;

    hub.publish(typing);
    publishMessage(hub, 1046);
    flush(1045);
    expect(a.chunks).toEqual([chunkOf(1046)]);

    hub.publish(typing);
    expect(a.chunks).toEqual([
      chunkOf(1046),
      `event: typing\ndata: ${JSON.stringify(typing.data)}\n\n`,
    ]);
  });

  it('depois do flush, os eventos vão direto; um segundo flush não reescreve nada', () => {
    const { hub } = newHub();
    const a = connection();
    const { flush } = hub.subscribe(a.conn, { recovering: true });
    publishMessage(hub, 1046);
    flush(1045);

    publishMessage(hub, 1047);
    flush(1045);

    expect(a.chunks).toEqual([chunkOf(1046), chunkOf(1047)]);
  });

  it('só a conexão em recuperação guarda os eventos; as outras recebem na hora', () => {
    const { hub } = newHub();
    const recovering = connection(ana.id);
    const live = connection(carlos.id);
    hub.subscribe(recovering.conn, { recovering: true });
    hub.subscribe(live.conn);

    publishMessage(hub, 1046);

    expect(recovering.chunks).toEqual([]);
    expect(live.chunks).toEqual([chunkOf(1046)]);
  });

  it('flush depois do unsubscribe não escreve nada', () => {
    const { hub } = newHub();
    const a = connection();
    const subscription = hub.subscribe(a.conn, { recovering: true });
    publishMessage(hub, 1046);

    subscription.unsubscribe();
    subscription.flush(1045);

    expect(a.chunks).toEqual([]);
  });

  it('write que lança no flush tira a conexão do hub', () => {
    const { hub } = newHub();
    const broken = brokenConnection();
    const { flush } = hub.subscribe(broken.conn, { recovering: true });
    publishMessage(hub, 1046);

    flush(1045);

    expect(broken.write).toHaveBeenCalledOnce();
    expect(hub.connectionCount()).toBe(0);
  });
});

describe('ChatHub.connectionCount', () => {
  it('conta todas ou só as de um participante', () => {
    const { hub } = newHub();
    hub.subscribe(connection(ana.id).conn);
    hub.subscribe(connection(ana.id).conn);
    hub.subscribe(connection(carlos.id).conn);

    expect(hub.connectionCount()).toBe(3);
    expect(hub.connectionCount(ana.id)).toBe(2);
    expect(hub.connectionCount(carlos.id)).toBe(1);
    expect(hub.connectionCount('a1b2c3d4-0000-4000-8000-000000000099')).toBe(0);
  });
});

describe('ChatHub: saída agendada', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fechar a única conexão → nada em 29 s; aos 30 s chama onAway uma vez com { id, token }', async () => {
    const { hub, onAway } = newHub();
    const { unsubscribe } = hub.subscribe(connection(ana.id).conn);

    unsubscribe();
    await vi.advanceTimersByTimeAsync(29_000);
    expect(onAway).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(onAway).toHaveBeenCalledExactlyOnceWith({
      id: ana.id,
      token: 'token',
    });

    await vi.advanceTimersByTimeAsync(60_000);
    expect(onAway).toHaveBeenCalledOnce();
  });

  it('awayDelayMs troca o atraso', async () => {
    const onAway = vi.fn(() => Promise.resolve());
    const hub = new ChatHub({ awayDelayMs: 5_000, onAway });
    hub.subscribe(connection(ana.id).conn).unsubscribe();

    await vi.advanceTimersByTimeAsync(4_999);
    expect(onAway).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(onAway).toHaveBeenCalledOnce();
  });

  it('nova conexão antes dos 30 s cancela a saída (F5)', async () => {
    const { hub, onAway } = newHub();
    hub.subscribe(connection(ana.id).conn).unsubscribe();

    await vi.advanceTimersByTimeAsync(29_000);
    hub.subscribe(connection(ana.id).conn);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(onAway).not.toHaveBeenCalled();
  });

  it('duas abas e fechar uma → não agenda; fechar a segunda → agenda', async () => {
    const { hub, onAway } = newHub();
    const { unsubscribe: closeFirst } = hub.subscribe(connection(ana.id).conn);
    const { unsubscribe: closeSecond } = hub.subscribe(connection(ana.id).conn);

    closeFirst();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(onAway).not.toHaveBeenCalled();

    closeSecond();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(onAway).toHaveBeenCalledExactlyOnceWith({
      id: ana.id,
      token: 'token',
    });
  });

  it('a conexão de outro participante não impede a saída', async () => {
    const { hub, onAway } = newHub();
    hub.subscribe(connection(carlos.id).conn);
    hub.subscribe(connection(ana.id).conn).unsubscribe();

    await vi.advanceTimersByTimeAsync(30_000);

    expect(onAway).toHaveBeenCalledExactlyOnceWith({
      id: ana.id,
      token: 'token',
    });
  });

  it('cancelAway cancela a saída agendada', async () => {
    const { hub, onAway } = newHub();
    hub.subscribe(connection(ana.id).conn).unsubscribe();

    hub.cancelAway(ana.id);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(onAway).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('onAway rejeitado → console.warn com o participante, sem propagar', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { hub } = newHub(vi.fn(() => Promise.reject(new Error('rede'))));
    hub.subscribe(connection(ana.id).conn).unsubscribe();

    await vi.advanceTimersByTimeAsync(30_000);

    expect(warn).toHaveBeenCalledExactlyOnceWith(
      'Saída por desconexão falhou',
      { participantId: ana.id },
    );
    warn.mockRestore();
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

  it('quando a saída vence, chama leaveParticipant com o id e o token', async () => {
    vi.useFakeTimers();
    const hub = getChatHub();
    hub.subscribe(connection(carlos.id).conn).unsubscribe();

    await vi.advanceTimersByTimeAsync(29_999);
    expect(leaveParticipant).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(leaveParticipant).toHaveBeenCalledExactlyOnceWith({
      id: carlos.id,
      token: 'token',
    });
    vi.useRealTimers();
  });

  it('a instância sobrevive a um novo import do módulo', async () => {
    const first = getChatHub();
    vi.resetModules();

    const reloaded = await import('./chat-hub');

    expect(reloaded.getChatHub()).toBe(first);
  });
});
