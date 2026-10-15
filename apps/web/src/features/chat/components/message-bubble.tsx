import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatTime } from '@/lib/format-time';
import { cn } from '@/lib/utils';
import { chatDictionary as t } from '../chat.dictionary';
import type { ChatMessage } from '../chat.types';

type MessageBubbleProps = {
  message: ChatMessage;
  /** The current participant wrote it: right side, brand colors, "Você". */
  own: boolean;
  /** Optimistic send state (F3); `sent` for messages from the server. */
  status?: 'sent' | 'sending' | 'failed';
  onRetry?: () => void;
};

export function MessageBubble({
  message,
  own,
  status = 'sent',
  onRetry,
}: MessageBubbleProps) {
  return (
    <div
      data-testid="message-bubble"
      className={cn('flex w-full gap-2', own ? 'justify-end' : 'justify-start')}
    >
      {!own && (
        <Avatar
          name={message.author.name}
          colorSeed={message.author.id}
          className="mt-5"
        />
      )}
      <div
        className={cn(
          'flex max-w-[80%] min-w-0 flex-col gap-1 md:max-w-[65%]',
          own ? 'items-end' : 'items-start',
        )}
      >
        <p className="text-xs text-fg-secondary">
          <span className="font-medium">
            {own ? t.room.you : message.author.name}
          </span>
          <span aria-hidden="true"> · </span>
          <time dateTime={message.createdAt}>
            {formatTime(message.createdAt)}
          </time>
        </p>
        <p
          data-testid="message-content"
          className={cn(
            'max-w-full rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]',
            own
              ? 'rounded-tr-sm bg-brand text-on-brand'
              : 'rounded-tl-sm bg-surface text-fg',
          )}
        >
          {message.content}
        </p>
        {status === 'sending' && (
          <p className="text-xs text-fg-muted">{t.message.sending}</p>
        )}
        {status === 'failed' && (
          <p className="flex items-center gap-1 text-xs text-destructive">
            {t.message.failed}
            <span aria-hidden="true">·</span>
            <Button
              variant="ghost"
              size="xs"
              className="text-brand-text"
              onClick={onRetry}
            >
              {t.message.retry}
            </Button>
          </p>
        )}
      </div>
    </div>
  );
}
