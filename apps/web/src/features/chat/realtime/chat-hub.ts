import 'server-only';
import type { ChatMessage, ChatParticipant } from '../chat.types';
import { leaveParticipant } from '../session/leave-participant';
import { formatSseEvent } from './sse';

export type HubEvent =
  | { type: 'message.created'; data: ChatMessage }
  | { type: 'presence.changed'; data: { online: number } }
  | { type: 'typing.started'; data: { participant: ChatParticipant } };

export interface HubConnection {
  participantId: string;
  token: string;
  write(chunk: string): void;
}

export interface AwayParticipant {
  id: string;
  token: string;
}

export interface ChatHubOptions {
  awayDelayMs?: number;
  onAway: (participant: AwayParticipant) => Promise<unknown>;
}

export interface Subscription {
  unsubscribe: () => void;
  /** Ends recovery: writes the buffered events, skipping messages up to `lastSeqWritten` (RECON-01 AC2). */
  flush: (lastSeqWritten: number) => void;
}

const GLOBAL_KEY = Symbol.for('web-hook.chat-hub');

// No default: a new event type leaves the function without a return and fails the typecheck.
function toSse(event: HubEvent): string {
  switch (event.type) {
    case 'message.created':
      return formatSseEvent({
        event: 'message',
        id: event.data.seq,
        data: event.data,
      });
    case 'typing.started':
      // No id: a typing notice must not move the Last-Event-ID cursor.
      return formatSseEvent({ event: 'typing', data: event.data });
    case 'presence.changed':
      return formatSseEvent({ event: 'presence', data: event.data });
  }
}

// Presence is state, not history: only the latest value is worth replaying.
// A typing notice expires in 5 s on the browser, so it is not replayed at all.
function bufferEvent(buffer: HubEvent[], event: HubEvent): void {
  if (event.type === 'typing.started') return;
  if (event.type === 'presence.changed') {
    const previous = buffer.findIndex((e) => e.type === 'presence.changed');
    if (previous !== -1) buffer.splice(previous, 1);
  }
  buffer.push(event);
}

/** Fans webhook events out to the open SSE connections of this process (AD-003). */
export class ChatHub {
  // A connection maps to its recovery buffer, or null once it receives events live.
  private readonly connections = new Map<HubConnection, HubEvent[] | null>();
  private readonly awayTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  private readonly awayDelayMs: number;
  private readonly onAway: ChatHubOptions['onAway'];

  constructor({ awayDelayMs = 30_000, onAway }: ChatHubOptions) {
    this.awayDelayMs = awayDelayMs;
    this.onAway = onAway;
  }

  subscribe(
    connection: HubConnection,
    options: { recovering?: boolean } = {},
  ): Subscription {
    this.cancelAway(connection.participantId);
    this.connections.set(connection, options.recovering ? [] : null);
    return {
      unsubscribe: () => {
        this.connections.delete(connection);
        if (this.connectionCount(connection.participantId) === 0) {
          this.scheduleAway(connection);
        }
      },
      flush: (lastSeqWritten) => {
        const buffer = this.connections.get(connection);
        if (!buffer) return;
        this.connections.set(connection, null);
        for (const event of buffer) {
          // The recovered history already holds these messages.
          if (
            event.type === 'message.created' &&
            event.data.seq <= lastSeqWritten
          ) {
            continue;
          }
          this.write(connection, toSse(event));
        }
      },
    };
  }

  /** Called by the explicit "Sair", so the participant does not leave twice (AWAY-01 AC5). */
  cancelAway(participantId: string): void {
    clearTimeout(this.awayTimers.get(participantId));
    this.awayTimers.delete(participantId);
  }

  // A closed tab sends nothing: leave once no stream comes back in time (AWAY-01).
  private scheduleAway({ participantId, token }: HubConnection): void {
    this.cancelAway(participantId);
    const timer = setTimeout(() => {
      this.awayTimers.delete(participantId);
      this.onAway({ id: participantId, token }).catch(() => {
        console.warn('Saída por desconexão falhou', { participantId });
      });
    }, this.awayDelayMs);
    this.awayTimers.set(participantId, timer);
  }

  publish(event: HubEvent): void {
    const chunk = toSse(event);
    for (const [connection, buffer] of this.connections) {
      if (buffer) bufferEvent(buffer, event);
      else this.write(connection, chunk);
    }
  }

  connectionCount(participantId?: string): number {
    if (participantId === undefined) return this.connections.size;
    let count = 0;
    for (const connection of this.connections.keys()) {
      if (connection.participantId === participantId) count++;
    }
    return count;
  }

  private write(connection: HubConnection, chunk: string): void {
    try {
      connection.write(chunk);
    } catch {
      // The browser left mid-write: drop only this connection.
      this.connections.delete(connection);
    }
  }
}

/** Process-wide hub: route handler and Server Action bundles share it, and it survives HMR (AD-003). */
export function getChatHub(): ChatHub {
  const store = globalThis as typeof globalThis & { [GLOBAL_KEY]?: ChatHub };
  return (store[GLOBAL_KEY] ??= new ChatHub({ onAway: leaveParticipant }));
}
