'use client';

import {
  useState,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { chatDictionary as t } from '../chat.dictionary';
import {
  messageSchema,
  type SendMessageAction,
} from '../schemas/message.schema';

type ComposerProps = {
  /** Server Action by props, so tests and stories can pass a fake. */
  send: SendMessageAction;
  /** Non-error notice above the field, e.g. "Reconectando…". */
  notice?: string;
};

export function Composer({ send, notice }: ComposerProps) {
  const [content, setContent] = useState('');
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const empty = content.trim() === '';
  // Same rule as the action: an empty field is just disabled, not an error.
  const tooLong =
    !empty && !messageSchema.shape.content.safeParse(content).success;
  const error = tooLong
    ? t.errors.messageTooLong
    : failed
      ? t.errors.send
      : undefined;
  const blocked = empty || tooLong || pending;

  function submit() {
    if (blocked) return;
    setFailed(false);
    startTransition(async () => {
      const result = await send({ content, clientId: crypto.randomUUID() });
      if (result.ok) setContent('');
      else setFailed(true);
    });
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
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
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
          onChange={(event) => setContent(event.target.value)}
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
