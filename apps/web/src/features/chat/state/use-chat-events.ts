import { useEffect, useEffectEvent, useState } from 'react';
import type { ChatMessage, ChatParticipant } from '../chat.types';
import type { ConnectionStatus } from './chat-room.reducer';

export type ChatEventHandlers = {
  onMessage(message: ChatMessage): void;
  onPresence(online: number): void;
  /** `reconnecting` on `error`, `open` when the stream (re)opens (RECON-02). */
  onStatus(status: ConnectionStatus): void;
  /** Someone started typing (TYPE-02 AC6); the event carries no `id:`. */
  onTyping?(participant: ChatParticipant): void;
};

export type ChatEventsOptions = {
  url?: string;
  /**
   * Last `seq` the page already has: the stream replays what came after it, so a
   * drop before the first `message` event loses nothing (RECON-01 AC8). Read once.
   */
  after?: number;
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
  { url = STREAM_URL, after, createEventSource }: ChatEventsOptions = {},
): void {
  // Fixed at mount: a new URL would reopen the stream on every message.
  const [target] = useState(() =>
    after === undefined ? url : `${url}?after=${after}`,
  );
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
  const onTyping = useEffectEvent((event: MessageEvent<string>) =>
    handlers.onTyping?.(
      (JSON.parse(event.data) as { participant: ChatParticipant }).participant,
    ),
  );
  const onStatus = useEffectEvent((status: ConnectionStatus) =>
    handlers.onStatus(status),
  );

  useEffect(() => {
    const source = open(target);
    source.addEventListener('message', (event) => onMessage(event));
    source.addEventListener('presence', (event) =>
      onPresence(event as MessageEvent<string>),
    );
    source.addEventListener('typing', (event) =>
      onTyping(event as MessageEvent<string>),
    );
    source.addEventListener('open', () => onStatus('open'));
    source.addEventListener('error', () => onStatus('reconnecting'));
    return () => source.close();
  }, [target]);
}
