import { useEffect, useEffectEvent } from 'react';
import type { ChatMessage } from '../chat.types';

export type ChatEventHandlers = {
  onMessage(message: ChatMessage): void;
  onPresence(online: number): void;
};

export type ChatEventsOptions = {
  url?: string;
  /** For tests and stories: jsdom has no EventSource. */
  createEventSource?: (url: string) => EventSource;
};

const STREAM_URL = '/chat/stream';

/**
 * Listens to the room's SSE stream. No reconnect code: EventSource reconnects
 * on its own, using the server's `retry:` (SSE-03 AC12).
 */
export function useChatEvents(
  handlers: ChatEventHandlers,
  { url = STREAM_URL, createEventSource }: ChatEventsOptions = {},
): void {
  // Effect events see the latest props without reopening the stream.
  const open = useEffectEvent((target: string) =>
    createEventSource ? createEventSource(target) : new EventSource(target),
  );
  const onMessage = useEffectEvent((event: MessageEvent<string>) =>
    handlers.onMessage(JSON.parse(event.data) as ChatMessage),
  );
  const onPresence = useEffectEvent((event: MessageEvent<string>) =>
    handlers.onPresence((JSON.parse(event.data) as { online: number }).online),
  );

  useEffect(() => {
    const source = open(url);
    source.addEventListener('message', (event) => onMessage(event));
    source.addEventListener('presence', (event) =>
      onPresence(event as MessageEvent<string>),
    );
    return () => source.close();
  }, [url]);
}
