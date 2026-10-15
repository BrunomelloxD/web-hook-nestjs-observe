'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { chatDictionary as t } from '../chat.dictionary';
import type { ChatMessage } from '../chat.types';
import { MessageBubble } from './message-bubble';
import { SystemMessage } from './system-message';

type MessageListProps = {
  messages: ChatMessage[];
  /** Messages by this participant render as "Você", on the right. */
  meId: string;
  /** Below the last message, e.g. the TypingIndicator. */
  footer?: ReactNode;
};

const SYSTEM_TEXT = {
  JOINED: t.system.joined,
  LEFT: t.system.left,
};

/** The list doesn't scroll itself: the Sala's <main> (or a story wrapper) does. */
function findScroller(element: HTMLElement): HTMLElement | null {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
  }
  return null;
}

export function MessageList({ messages, meId, footer }: MessageListProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  // Before the first paint, so the page opens on the last message (ROOM-01 AC2).
  useLayoutEffect(() => {
    const scroller = findScroller(rootRef.current!);
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, []);

  return (
    <div
      ref={rootRef}
      className="flex min-h-full flex-col justify-end gap-3 p-4"
    >
      <ol
        aria-live="polite"
        aria-label={t.room.messages}
        className="flex flex-col gap-3"
      >
        {messages.length === 0 && (
          <li className="text-center text-sm text-fg-muted">{t.room.empty}</li>
        )}
        {messages.map((message) => (
          <li key={message.id}>
            {message.type === 'USER' ? (
              <MessageBubble
                message={message}
                own={message.author.id === meId}
              />
            ) : (
              <SystemMessage
                text={SYSTEM_TEXT[message.type](message.author.name)}
              />
            )}
          </li>
        ))}
      </ol>
      {footer}
    </div>
  );
}
