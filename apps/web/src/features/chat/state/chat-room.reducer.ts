import type { ChatMessage } from '../chat.types';

export type ChatRoomState = { messages: ChatMessage[]; online: number };

export type ChatRoomAction =
  | { type: 'message/received'; message: ChatMessage }
  | { type: 'presence/changed'; online: number };

export function initChatRoom({
  messages,
  online,
}: ChatRoomState): ChatRoomState {
  return { messages, online };
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

export function chatRoomReducer(
  state: ChatRoomState,
  action: ChatRoomAction,
): ChatRoomState {
  switch (action.type) {
    case 'message/received': {
      const { messages } = state;
      const index = lowerBound(messages, action.message.seq);
      // Webhook retries and our own sends can repeat a seq: keep the first.
      if (messages[index]?.seq === action.message.seq) return state;
      return {
        ...state,
        messages: [
          ...messages.slice(0, index),
          action.message,
          ...messages.slice(index),
        ],
      };
    }
    case 'presence/changed':
      return { ...state, online: action.online };
  }
}
