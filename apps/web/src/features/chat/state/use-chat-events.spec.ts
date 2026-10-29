import { renderHook } from '@testing-library/react';
import { fakeEventSources } from '../../../../test/fake-event-source';
import { ana, makeMessage } from '../test-fixtures';
import { useChatEvents } from './use-chat-events';

function handlers() {
  return { onMessage: vi.fn(), onPresence: vi.fn(), onStatus: vi.fn() };
}

describe('useChatEvents', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('abre um único EventSource para /chat/stream (SSE-02 AC8)', () => {
    const sources = fakeEventSources();

    const { rerender } = renderHook(
      (props) => useChatEvents(props, { createEventSource: sources.create }),
      { initialProps: handlers() },
    );
    // New handler identities on every render must not reopen the stream.
    rerender(handlers());
    rerender(handlers());

    expect(sources.instances.map((source) => source.url)).toEqual([
      '/chat/stream',
    ]);
  });

  it('sem createEventSource, usa o EventSource do navegador com /chat/stream', () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'EventSource',
      class {
        constructor(url: string) {
          urls.push(url);
        }
        addEventListener() {}
        close() {}
      },
    );

    renderHook(() => useChatEvents(handlers()));

    expect(urls).toEqual(['/chat/stream']);
  });

  it('com after, abre /chat/stream?after=<seq> (RECON-01 AC8)', () => {
    const sources = fakeEventSources();

    renderHook(() =>
      useChatEvents(handlers(), {
        after: 1040,
        createEventSource: sources.create,
      }),
    );

    expect(sources.instances.map((source) => source.url)).toEqual([
      '/chat/stream?after=1040',
    ]);
  });

  it('um after novo depois da montagem não reabre o stream nem muda a URL', () => {
    const sources = fakeEventSources();
    const h = handlers();

    const { rerender } = renderHook(
      (after: number) =>
        useChatEvents(h, { after, createEventSource: sources.create }),
      { initialProps: 1040 },
    );
    rerender(1041);

    expect(sources.instances.map((source) => source.url)).toEqual([
      '/chat/stream?after=1040',
    ]);
    expect(sources.instances[0]!.closed).toBe(false);
  });

  it('evento "message" chama onMessage com o JSON do data', () => {
    const sources = fakeEventSources();
    const h = handlers();
    renderHook(() => useChatEvents(h, { createEventSource: sources.create }));
    const message = makeMessage({ id: 'm-7', seq: 7, content: 'ao vivo' });

    sources.instances[0]!.emit('message', message);

    expect(h.onMessage).toHaveBeenCalledExactlyOnceWith(message);
    expect(h.onPresence).not.toHaveBeenCalled();
  });

  it('evento "presence" chama onPresence com o online do data', () => {
    const sources = fakeEventSources();
    const h = handlers();
    renderHook(() => useChatEvents(h, { createEventSource: sources.create }));

    sources.instances[0]!.emit('presence', { online: 4 });

    expect(h.onPresence).toHaveBeenCalledExactlyOnceWith(4);
    expect(h.onMessage).not.toHaveBeenCalled();
  });

  it('evento "typing" chama onTyping com o participante do data (TYPE-02 AC6)', () => {
    const sources = fakeEventSources();
    const h = { ...handlers(), onTyping: vi.fn() };
    renderHook(() => useChatEvents(h, { createEventSource: sources.create }));

    sources.instances[0]!.emit('typing', {
      participant: { id: ana.id, name: 'Ana' },
    });

    expect(h.onTyping).toHaveBeenCalledExactlyOnceWith({
      id: ana.id,
      name: 'Ana',
    });
    expect(h.onMessage).not.toHaveBeenCalled();
    expect(h.onPresence).not.toHaveBeenCalled();
  });

  it('evento "typing" sem onTyping não chama os outros handlers', () => {
    const sources = fakeEventSources();
    const h = handlers();
    renderHook(() => useChatEvents(h, { createEventSource: sources.create }));

    sources.instances[0]!.emit('typing', {
      participant: { id: ana.id, name: 'Ana' },
    });

    expect(h.onMessage).not.toHaveBeenCalled();
    expect(h.onPresence).not.toHaveBeenCalled();
    expect(h.onStatus).not.toHaveBeenCalled();
  });

  it('usa os handlers da última renderização', () => {
    const sources = fakeEventSources();
    const first = handlers();
    const latest = handlers();
    const { rerender } = renderHook(
      (props) => useChatEvents(props, { createEventSource: sources.create }),
      { initialProps: first },
    );
    rerender(latest);

    sources.instances[0]!.emit('presence', { online: 2 });

    expect(latest.onPresence).toHaveBeenCalledExactlyOnceWith(2);
    expect(first.onPresence).not.toHaveBeenCalled();
  });

  it('unmount fecha o EventSource', () => {
    const sources = fakeEventSources();
    const { unmount } = renderHook(() =>
      useChatEvents(handlers(), { createEventSource: sources.create }),
    );
    expect(sources.instances[0]!.closed).toBe(false);

    unmount();

    expect(sources.instances[0]!.closed).toBe(true);
  });

  it('"error" não cria outro EventSource, não agenda timer nem faz fetch (SSE-03 AC12-13)', () => {
    vi.useFakeTimers();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const sources = fakeEventSources();
    renderHook(() =>
      useChatEvents(handlers(), { createEventSource: sources.create }),
    );

    sources.instances[0]!.dispatchEvent(new Event('error'));
    vi.advanceTimersByTime(60_000);

    expect(sources.instances).toHaveLength(1);
    expect(sources.instances[0]!.closed).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('"error" chama onStatus("reconnecting") e "open" chama onStatus("open"), sem timer (RECON-02 AC5-6)', () => {
    vi.useFakeTimers();
    const sources = fakeEventSources();
    const h = handlers();
    renderHook(() => useChatEvents(h, { createEventSource: sources.create }));
    const source = sources.instances[0]!;

    source.dispatchEvent(new Event('error'));
    expect(h.onStatus).toHaveBeenCalledExactlyOnceWith('reconnecting');

    source.dispatchEvent(new Event('open'));
    expect(h.onStatus).toHaveBeenLastCalledWith('open');
    expect(h.onStatus).toHaveBeenCalledTimes(2);

    expect(vi.getTimerCount()).toBe(0);
    expect(sources.instances).toHaveLength(1);
    expect(h.onMessage).not.toHaveBeenCalled();
    expect(h.onPresence).not.toHaveBeenCalled();
  });
});
