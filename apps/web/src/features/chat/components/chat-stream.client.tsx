'use client';

import { useReducer } from 'react';
import type { ChatMessage, ChatParticipant } from '../chat.types';
import type { SendMessageAction } from '../schemas/message.schema';
import { chatRoomReducer, initChatRoom } from '../state/chat-room.reducer';
import { useChatEvents } from '../state/use-chat-events';
import { ChatHeader } from './chat-header';
import { ChatRoomView } from './chat-room-view';
import { Composer } from './composer.client';
import { MessageList } from './message-list.client';

type ChatStreamProps = {
  me: ChatParticipant;
  initialMessages: ChatMessage[];
  initialOnline: number;
  /** Server Actions by props, so tests and stories can pass fakes. */
  actions: { send: SendMessageAction; leave: () => Promise<void> };
  /** For tests and stories: jsdom has no EventSource. */
  createEventSource?: (url: string) => EventSource;
};

/** The only component that opens an EventSource; owns the Sala's state (SSE-02 AC8). */
export function ChatStream({
  me,
  initialMessages,
  initialOnline,
  actions,
  createEventSource,
}: ChatStreamProps) {
  const [state, dispatch] = useReducer(
    chatRoomReducer,
    { messages: initialMessages, online: initialOnline },
    initChatRoom,
  );

  useChatEvents(
    {
      onMessage: (message) => dispatch({ type: 'message/received', message }),
      onPresence: (online) => dispatch({ type: 'presence/changed', online }),
    },
    { createEventSource },
  );

  // After sending, nothing to do here: the own message arrives over SSE.
  return (
    <ChatRoomView
      header={
        <ChatHeader me={me} online={state.online} leaveAction={actions.leave} />
      }
      list={<MessageList messages={state.messages} meId={me.id} />}
      composer={<Composer send={actions.send} />}
    />
  );
}
