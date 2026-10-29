'use client';

import {
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { chatDictionary as t } from '../chat.dictionary';
import { messageSchema, type MessageInput } from '../schemas/message.schema';

/** At most one typing notice per this interval while there are keystrokes (TYPE-01 AC1). */
export const TYPING_NOTIFY_INTERVAL_MS = 3_000;

type ComposerProps = {
  /**
   * Called on Enter or "Enviar". The field clears right away: the send's
   * progress and failure show on the message itself (OPT-01).
   */
  onSend: (input: MessageInput) => void;
  /** Non-error notice above the field, e.g. "Reconectando…". */
  notice?: string;
  /** Error above the field, e.g. the send rate limit (RATE-02). */
  error?: string;
  /** Called on a keystroke that leaves text in the field, at most once every 3 s; a send restarts the 3 s. */
  onTyping?: () => void;
};

export function Composer({ onSend, notice, error, onTyping }: ComposerProps) {
  const [content, setContent] = useState('');
  // Instant of the last onTyping call: compared on each keystroke, no timers.
  const lastTypingAt = useRef(-Infinity);

  const empty = content.trim() === '';
  // Same rule as the action: an empty field is just disabled, not an error.
  const tooLong =
    !empty && !messageSchema.shape.content.safeParse(content).success;
  const shownError = tooLong ? t.errors.messageTooLong : error;
  const blocked = empty || tooLong;

  function submit() {
    if (blocked) return;
    onSend({ content, clientId: crypto.randomUUID() });
    setContent('');
    // The sent message clears the notice for others: the next key tells them again (TYPE-01 AC12).
    lastTypingAt.current = -Infinity;
  }

  function onChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const { value } = event.target;
    setContent(value);
    if (value.trim() === '' || !onTyping) return;
    const now = Date.now();
    if (now - lastTypingAt.current < TYPING_NOTIFY_INTERVAL_MS) return;
    lastTypingAt.current = now;
    onTyping();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  // Enter sends; Shift+Enter keeps the browser's line break.
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    submit();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      {shownError && (
        <p role="alert" className="text-sm text-destructive">
          {shownError}
        </p>
      )}
      {notice && (
        <p aria-live="polite" className="text-sm text-fg-secondary">
          {notice}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Label htmlFor="composer-message" className="sr-only">
          {t.composer.label}
        </Label>
        <textarea
          id="composer-message"
          name="content"
          rows={1}
          value={content}
          onChange={onChange}
          onKeyDown={onKeyDown}
          aria-invalid={tooLong ? true : undefined}
          placeholder={t.composer.placeholder}
          className="h-12 min-w-0 flex-1 resize-none rounded-[10px] border border-line bg-subtle px-4 py-3 text-sm text-fg outline-none placeholder:text-fg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button
          type="submit"
          disabled={blocked}
          className="h-12 rounded-[10px] px-4"
        >
          {t.composer.send}
        </Button>
      </div>
    </form>
  );
}
