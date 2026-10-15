import 'server-only';
import type { ChatMessage } from '../chat.types';
import { formatSseEvent } from './sse';

export type HubEvent =
  | { type: 'message.created'; data: ChatMessage }
  | { type: 'presence.changed'; data: { online: number } };

export interface HubConnection {
  participantId: string;
  token: string;
  write(chunk: string): void;
}

const GLOBAL_KEY = Symbol.for('web-hook.chat-hub');

function toSse(event: HubEvent): string {
  if (event.type === 'message.created') {
    return formatSseEvent({
      event: 'message',
      id: event.data.seq,
      data: event.data,
    });
  }
  return formatSseEvent({ event: 'presence', data: event.data });
}

/** Fans webhook events out to the open SSE connections of this process (AD-003). */
export class ChatHub {
  private readonly connections = new Set<HubConnection>();

  subscribe(connection: HubConnection): () => void {
    this.connections.add(connection);
    return () => {
      this.connections.delete(connection);
    };
  }

  publish(event: HubEvent): void {
    const chunk = toSse(event);
    for (const connection of this.connections) {
      try {
        connection.write(chunk);
      } catch {
        // The browser left mid-write: drop only this connection.
        this.connections.delete(connection);
      }
    }
  }

  connectionCount(participantId?: string): number {
    if (participantId === undefined) return this.connections.size;
    let count = 0;
    for (const connection of this.connections) {
      if (connection.participantId === participantId) count++;
    }
    return count;
  }
}

/** Process-wide hub: route handler and Server Action bundles share it, and it survives HMR (AD-003). */
export function getChatHub(): ChatHub {
  const store = globalThis as typeof globalThis & { [GLOBAL_KEY]?: ChatHub };
  return (store[GLOBAL_KEY] ??= new ChatHub());
}
