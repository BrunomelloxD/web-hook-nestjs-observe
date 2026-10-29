'use client';

import { useEffect, useReducer, useState } from 'react';
import { chatDictionary as t } from '../chat.dictionary';
import type {
  ChatMessage,
  ChatParticipant,
  LoadOlderMessagesAction,
  LoadOlderMessagesResult,
} from '../chat.types';
import type {
  MessageInput,
  SendMessageAction,
  SendMessageResult,
} from '../schemas/message.schema';
import {
  chatRoomReducer,
  initChatRoom,
  selectItems,
  selectTypingNames,
} from '../state/chat-room.reducer';
import { useChatEvents } from '../state/use-chat-events';
import { ChatHeader } from './chat-header';
import { ChatRoomView } from './chat-room-view';
import { Composer } from './composer.client';
import { MessageList } from './message-list.client';
import { TypingIndicator } from './typing-indicator';

type ChatStreamProps = {
  me: ChatParticipant;
  initialMessages: ChatMessage[];
  initialOnline: number;
  /** Server Actions by props, so tests and stories can pass fakes. */
  actions: {
    send: SendMessageAction;
    leave: () => Promise<void>;
    /** Tells the room this participant is typing (TYPE-01). */
    typing?: () => Promise<void>;
    /** Older page before a seq; without it there is no "Carregar mensagens anteriores". */
    loadOlder?: LoadOlderMessagesAction;
  };
  /** For tests and stories: jsdom has no EventSource. */
  createEventSource?: (url: string) => EventSource;
};

/** A Server Action call that can't reach the server rejects instead of returning. */
const UNREACHABLE: SendMessageResult = { ok: false, reason: 'unexpected' };
const HISTORY_UNREACHABLE: LoadOlderMessagesResult = { ok: false };

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
    { messages: initialMessages, online: initialOnline, meId: me.id },
    initChatRoom,
  );
  const [rateLimited, setRateLimited] = useState(false);
  // Bumped on every send so the list scrolls down to it (SCROLL-01 AC5).
  const [scrollKey, setScrollKey] = useState(0);

  useChatEvents(
    {
      onMessage: (message) => dispatch({ type: 'message/received', message }),
      onPresence: (online) => dispatch({ type: 'presence/changed', online }),
      onStatus: (status) => dispatch({ type: 'connection/changed', status }),
      onTyping: (participant) =>
        dispatch({ type: 'typing/started', participant, now: Date.now() }),
    },
    // Initial messages come in ascending seq: the stream replays what came after the last one.
    { after: initialMessages.at(-1)?.seq, createEventSource },
  );

  const nextExpiry = Math.min(
    ...Object.values(state.typing).map((entry) => entry.expiresAt),
  );
  // Not polling: this timer only expires local state and fetches nothing. It
  // exists only while someone is typing, one for the room (TYPE-02 AC8).
  useEffect(() => {
    if (nextExpiry === Infinity) return;
    const timer = setTimeout(
      // At least nextExpiry, so a timer that fires a bit early still expires it.
      () =>
        dispatch({
          type: 'typing/expired',
          now: Math.max(Date.now(), nextExpiry),
        }),
      nextExpiry - Date.now(),
    );
    return () => clearTimeout(timer);
  }, [nextExpiry]);

  // SPEC_DEVIATION: the design calls the action inside startTransition.
  // Reason: React holds updates made in async transitions until every pending
  // one ends, so a confirmation would wait for later sends.
  async function deliver(input: MessageInput) {
    setRateLimited(false);
    const result = await actions.send(input).catch(() => UNREACHABLE);
    if (result.ok) {
      // The SSE event may come first or later: the reducer keeps one (OPT-01 AC2-3).
      dispatch({ type: 'message/confirmed', message: result.message });
      return;
    }
    dispatch({ type: 'message/failed', clientId: input.clientId });
    if (result.reason === 'rate_limited') setRateLimited(true);
  }

  function send(input: MessageInput) {
    dispatch({
      type: 'message/optimistic',
      clientId: input.clientId,
      content: input.content,
      createdAt: new Date().toISOString(),
    });
    setScrollKey((key) => key + 1);
    void deliver(input);
  }

  // Same clientId, so the api returns the stored message if the first try got through.
  function retry(clientId: string) {
    const { content } = state.pending.find(
      (item) => item.clientId === clientId,
    )!;
    dispatch({ type: 'message/retry', clientId });
    void deliver({ content, clientId });
  }

  // hasMore implies a full page is loaded, so there is a first message.
  async function loadOlder(load: LoadOlderMessagesAction) {
    dispatch({ type: 'history/requested' });
    const result = await load(state.messages[0]!.seq).catch(
      () => HISTORY_UNREACHABLE,
    );
    dispatch(
      result.ok
        ? { type: 'history/loaded', items: result.items }
        : { type: 'history/failed' },
    );
  }

  // Fire and forget. The action already ignores api errors; a call that
  // can't reach the server still rejects here, and nothing waits for it.
  function notifyTyping(typing: () => Promise<void>) {
    void typing().catch(() => {});
  }

  const { loadOlder: loadOlderAction, typing: typingAction } = actions;

  return (
    <ChatRoomView
      header={
        <ChatHeader me={me} online={state.online} leaveAction={actions.leave} />
      }
      list={
        <MessageList
          items={selectItems(state)}
          meId={me.id}
          onRetry={retry}
          scrollKey={scrollKey}
          history={
            loadOlderAction && {
              ...state.history,
              onLoad: () => void loadOlder(loadOlderAction),
            }
          }
        />
      }
      composer={
        <>
          {/* Between the list and the field, always in view (TYPE-02). */}
          <div aria-live="polite" className="not-empty:pb-2">
            <TypingIndicator names={selectTypingNames(state)} />
          </div>
          <Composer
            onSend={send}
            onTyping={typingAction && (() => notifyTyping(typingAction))}
            notice={
              state.connection === 'reconnecting'
                ? t.errors.reconnecting
                : undefined
            }
            error={rateLimited ? t.errors.rateLimited : undefined}
          />
        </>
      }
    />
  );
}
