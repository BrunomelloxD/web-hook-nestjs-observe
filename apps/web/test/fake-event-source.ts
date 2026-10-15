/**
 * Stand-in for the browser EventSource (jsdom has none), shared by unit tests
 * and stories. `create` records every source it opens.
 */
export class FakeEventSource extends EventTarget {
  closed = false;

  constructor(readonly url: string) {
    super();
  }

  close() {
    this.closed = true;
  }

  /** Dispatches a named SSE event, as the browser does for `event: <type>`. */
  emit(type: string, data: unknown) {
    this.dispatchEvent(new MessageEvent(type, { data: JSON.stringify(data) }));
  }
}

export function fakeEventSources() {
  const instances: FakeEventSource[] = [];
  return {
    instances,
    create: (url: string) => {
      const source = new FakeEventSource(url);
      instances.push(source);
      return source as unknown as EventSource;
    },
  };
}
