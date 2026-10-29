'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { chatDictionary as t } from '../chat.dictionary';
import type { ChatMessage } from '../chat.types';
import type {
  ChatItem,
  HistoryStatus,
  PendingMessage,
} from '../state/chat-room.reducer';
import { useStickToBottom } from '../state/use-stick-to-bottom';
import { MessageBubble } from './message-bubble';
import { SystemMessage } from './system-message';

type MessageListProps = {
  /** Confirmed messages by seq, then the pending (optimistic) sends. */
  items: ChatItem[];
  /** Messages by this participant render as "Você", on the right. */
  meId: string;
  /** Below the last message, e.g. the TypingIndicator. */
  footer?: ReactNode;
  /** "Tentar de novo" on a failed pending send. */
  onRetry?: (clientId: string) => void;
  /** Changes when the reader sends: scrolls to the bottom even while reading older messages. */
  scrollKey?: number;
  /** "Carregar mensagens anteriores" at the top while `hasMore` (HIST-01). */
  history?: { hasMore: boolean; status: HistoryStatus; onLoad: () => void };
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

function firstSeq(items: ChatItem[]): number | undefined {
  const first = items[0];
  return first?.kind === 'confirmed' ? first.message.seq : undefined;
}

/** A pending send has no seq or author from the server yet: it's always ours. */
function pendingAsMessage(item: PendingMessage, meId: string): ChatMessage {
  return {
    id: item.clientId,
    seq: 0,
    type: 'USER',
    content: item.content,
    clientId: item.clientId,
    author: { id: meId, name: t.room.you },
    createdAt: item.createdAt,
  };
}

export function MessageList({
  items,
  meId,
  footer,
  onRetry,
  scrollKey = 0,
  history,
}: MessageListProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLElement>(null);
  // Messages before the first one at mount came from "Carregar mensagens anteriores".
  const [mountSeq] = useState(() => firstSeq(items));
  const older =
    mountSeq === undefined
      ? 0
      : items.filter(
          (item) => item.kind === 'confirmed' && item.message.seq < mountSeq,
        ).length;
  // First seq and scrollHeight at the last commit.
  const lastLayout = useRef<{ seq?: number; height: number }>(undefined);

  // Declared before useStickToBottom, so its effects see the scroller.
  useLayoutEffect(() => {
    scrollerRef.current = findScroller(rootRef.current!);
  }, []);
  // Opens on the last message (ROOM-01 AC2) and follows new ones (SCROLL-01).
  // Older messages don't count: they are not new at the bottom.
  const { showNewBelow, scrollToBottom } = useStickToBottom(scrollerRef, {
    count: items.length - older,
    forceKey: scrollKey,
  });

  // Older messages went in above: move down by the height they added, so the
  // message that was at the top stays in place (HIST-01 AC3). Measured at every
  // commit, so live messages that came during the fetch don't count.
  const seq = firstSeq(items);
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const last = lastLayout.current;
    if ((seq ?? Infinity) < (last?.seq ?? -Infinity)) {
      scroller.scrollTop += scroller.scrollHeight - last!.height;
    }
    lastLayout.current = { seq, height: scroller.scrollHeight };
  });

  const loading = history?.status === 'loading';

  return (
    <div
      ref={rootRef}
      // Browser scroll anchoring would move the list too, on top of ours.
      className="flex min-h-full flex-col justify-end gap-3 p-4 [overflow-anchor:none]"
    >
      {history?.hasMore && (
        <div className="flex flex-col items-center gap-2">
          {history.status === 'error' && (
            <p role="alert" className="text-sm text-destructive">
              {t.errors.loadOlderFailed}
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={history.onLoad}
            className="rounded-full border-line bg-surface text-fg hover:bg-subtle"
          >
            {loading ? t.room.loadingOlder : t.room.loadOlder}
          </Button>
        </div>
      )}
      <ol
        aria-live="polite"
        aria-label={t.room.messages}
        className="flex flex-col gap-3"
      >
        {items.length === 0 && (
          <li className="text-center text-sm text-fg-muted">{t.room.empty}</li>
        )}
        {items.map((item) => {
          if (item.kind === 'pending') {
            return (
              <li key={item.clientId}>
                <MessageBubble
                  message={pendingAsMessage(item, meId)}
                  own
                  status={item.status}
                  onRetry={() => onRetry?.(item.clientId)}
                />
              </li>
            );
          }
          const { message } = item;
          return (
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
          );
        })}
      </ol>
      {footer}
      {showNewBelow && (
        <div className="sticky bottom-3 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={scrollToBottom}
            className="rounded-full border-line bg-surface text-fg shadow-sm hover:bg-subtle"
          >
            {t.room.newMessages}
          </Button>
        </div>
      )}
    </div>
  );
}
