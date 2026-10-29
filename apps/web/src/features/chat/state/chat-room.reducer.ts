import type { ChatMessage, ChatParticipant } from '../chat.types';

export type ConnectionStatus = 'open' | 'reconnecting';

/** Size of the initial page and of each older page (HIST-01). */
export const HISTORY_PAGE_SIZE = 50;

/** How long a `typing` event keeps a name on the TypingIndicator (TYPE-02 AC8). */
export const TYPING_TTL_MS = 5_000;

export type HistoryStatus = 'idle' | 'loading' | 'error';

/** A sent message the server hasn't confirmed yet (no seq). */
export type PendingMessage = {
  clientId: string;
  content: string;
  createdAt: string;
  status: 'sending' | 'failed';
};

export type ChatItem =
  | { kind: 'confirmed'; message: ChatMessage }
  | ({ kind: 'pending' } & PendingMessage);

export type ChatRoomState = {
  messages: ChatMessage[];
  online: number;
  pending: PendingMessage[];
  connection: ConnectionStatus;
  /** The current participant: their own `typing` events are ignored (TYPE-02 AC7). */
  meId?: string;
  /** Who is typing, by participant id, in arrival order. */
  typing: Record<string, { name: string; expiresAt: number }>;
  /** `hasMore` while the last loaded page was full (HIST-01 AC1, AC5). */
  history: { hasMore: boolean; status: HistoryStatus };
};

export type ChatRoomAction =
  | { type: 'message/received'; message: ChatMessage }
  | {
      type: 'message/optimistic';
      clientId: string;
      content: string;
      createdAt: string;
    }
  | { type: 'message/confirmed'; message: ChatMessage }
  | { type: 'message/failed'; clientId: string }
  | { type: 'message/retry'; clientId: string }
  | { type: 'presence/changed'; online: number }
  | { type: 'connection/changed'; status: ConnectionStatus }
  | { type: 'typing/started'; participant: ChatParticipant; now: number }
  | { type: 'typing/expired'; now: number }
  | { type: 'history/requested' }
  | { type: 'history/loaded'; items: ChatMessage[] }
  | { type: 'history/failed' };

export function initChatRoom({
  messages,
  online,
  meId,
}: Pick<ChatRoomState, 'messages' | 'online' | 'meId'>): ChatRoomState {
  return {
    messages,
    online,
    pending: [],
    connection: 'open',
    meId,
    typing: {},
    history: {
      hasMore: messages.length === HISTORY_PAGE_SIZE,
      status: 'idle',
    },
  };
}

/** First index whose seq is >= `seq` (the list is sorted by seq). */
function lowerBound(messages: ChatMessage[], seq: number): number {
  let low = 0;
  let high = messages.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (messages[mid]!.seq < seq) low = mid + 1;
    else high = mid;
  }
  return low;
}

/** SSE event or action result: both settle the pending send with the same clientId. */
function confirm(state: ChatRoomState, message: ChatMessage): ChatRoomState {
  const pending = state.pending.filter(
    (item) => item.clientId !== message.clientId,
  );
  const settled = pending.length !== state.pending.length;
  const { messages } = state;
  const index = lowerBound(messages, message.seq);
  // Webhook retries and the action's result can repeat a seq: keep the first.
  if (messages[index]?.seq === message.seq) {
    return settled ? { ...state, pending } : state;
  }
  return {
    ...state,
    pending,
    messages: [...messages.slice(0, index), message, ...messages.slice(index)],
  };
}

function setStatus(
  state: ChatRoomState,
  clientId: string,
  status: PendingMessage['status'],
): ChatRoomState {
  return {
    ...state,
    pending: state.pending.map((item) =>
      item.clientId === clientId ? { ...item, status } : item,
    ),
  };
}

/** A USER message ends its author's typing notice right away (TYPE-02 AC9). */
function stopTyping(state: ChatRoomState, message: ChatMessage): ChatRoomState {
  if (message.type !== 'USER' || !(message.author.id in state.typing)) {
    return state;
  }
  const typing = Object.entries(state.typing).filter(
    ([id]) => id !== message.author.id,
  );
  return { ...state, typing: Object.fromEntries(typing) };
}

function startTyping(
  state: ChatRoomState,
  { id, name }: ChatParticipant,
  now: number,
): ChatRoomState {
  if (id === state.meId) return state;
  // An existing key keeps its place: the order is the first arrival.
  return {
    ...state,
    typing: { ...state.typing, [id]: { name, expiresAt: now + TYPING_TTL_MS } },
  };
}

function expireTyping(state: ChatRoomState, now: number): ChatRoomState {
  const entries = Object.entries(state.typing);
  const alive = entries.filter(([, entry]) => entry.expiresAt > now);
  if (alive.length === entries.length) return state;
  return { ...state, typing: Object.fromEntries(alive) };
}

/**
 * Older messages go before the loaded ones. Live messages that came during the
 * fetch can overlap the page: a seq already present is skipped (HIST-01 AC7).
 */
function prependHistory(
  state: ChatRoomState,
  items: ChatMessage[],
): ChatRoomState {
  const known = new Set(state.messages.map((message) => message.seq));
  const older = items.filter((message) => !known.has(message.seq));
  return {
    ...state,
    messages: [...older, ...state.messages].sort((a, b) => a.seq - b.seq),
    history: {
      hasMore: items.length === HISTORY_PAGE_SIZE,
      status: 'idle',
    },
  };
}

export function chatRoomReducer(
  state: ChatRoomState,
  action: ChatRoomAction,
): ChatRoomState {
  switch (action.type) {
    case 'message/received':
      return stopTyping(confirm(state, action.message), action.message);
    case 'message/confirmed':
      return confirm(state, action.message);
    case 'message/optimistic':
      return {
        ...state,
        pending: [
          ...state.pending,
          {
            clientId: action.clientId,
            content: action.content,
            createdAt: action.createdAt,
            status: 'sending',
          },
        ],
      };
    case 'message/failed':
      return setStatus(state, action.clientId, 'failed');
    case 'message/retry':
      return setStatus(state, action.clientId, 'sending');
    case 'presence/changed':
      return { ...state, online: action.online };
    case 'connection/changed':
      return { ...state, connection: action.status };
    case 'typing/started':
      return startTyping(state, action.participant, action.now);
    case 'typing/expired':
      return expireTyping(state, action.now);
    case 'history/requested':
      return { ...state, history: { ...state.history, status: 'loading' } };
    case 'history/loaded':
      return prependHistory(state, action.items);
    case 'history/failed':
      return { ...state, history: { ...state.history, status: 'error' } };
  }
}

/** Confirmed messages by seq, then the pending ones, which have no seq yet. */
export function selectItems(state: ChatRoomState): ChatItem[] {
  return [
    ...state.messages.map((message) => ({
      kind: 'confirmed' as const,
      message,
    })),
    ...state.pending.map((item) => ({ kind: 'pending' as const, ...item })),
  ];
}

/** Names on the TypingIndicator, in arrival order. */
export function selectTypingNames(state: ChatRoomState): string[] {
  return Object.values(state.typing).map((entry) => entry.name);
}
