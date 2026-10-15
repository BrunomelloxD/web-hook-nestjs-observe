import {
  formatSseEvent,
  HEARTBEAT_MS,
  SSE_HEADERS,
  SSE_HEARTBEAT,
} from './sse';

describe('formatSseEvent', () => {
  it('com id → linhas id, event e data, terminadas por linha em branco', () => {
    expect(
      formatSseEvent({
        event: 'message',
        id: 7,
        data: { seq: 7, content: 'oi' },
      }),
    ).toBe('id: 7\nevent: message\ndata: {"seq":7,"content":"oi"}\n\n');
  });

  it('sem id → sem linha id:', () => {
    expect(formatSseEvent({ event: 'presence', data: { online: 3 } })).toBe(
      'event: presence\ndata: {"online":3}\n\n',
    );
  });

  it('quebra de linha no conteúdo fica escapada numa só linha data:', () => {
    expect(
      formatSseEvent({ event: 'message', id: 1, data: { content: 'a\nb' } }),
    ).toBe('id: 1\nevent: message\ndata: {"content":"a\\nb"}\n\n');
  });
});

describe('heartbeat', () => {
  it('é o comentário ": heartbeat" seguido de linha em branco, a cada 25 s', () => {
    expect(SSE_HEARTBEAT).toBe(': heartbeat\n\n');
    expect(HEARTBEAT_MS).toBe(25_000);
  });
});

describe('SSE_HEADERS', () => {
  it('são os headers exatos do design', () => {
    expect(SSE_HEADERS).toEqual({
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
      connection: 'keep-alive',
    });
  });
});
