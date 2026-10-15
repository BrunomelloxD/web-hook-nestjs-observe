'use client';

import { Hash } from 'lucide-react';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { chatDictionary as t } from '../chat.dictionary';
import {
  initialJoinFormState as initialState,
  type JoinAction,
} from '../schemas/join-form.schema';

export type { JoinAction, JoinFormState } from '../schemas/join-form.schema';

type JoinFormProps = {
  /** A prop, so tests and stories can pass a fake. */
  action: JoinAction;
};

export function JoinForm({ action }: JoinFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const error = state.status === 'error' ? state : undefined;

  return (
    <div className="flex w-full flex-col gap-7 rounded-2xl border border-line bg-surface p-6 shadow-card md:w-[420px] md:p-10">
      <div className="flex flex-col gap-4">
        <span
          aria-hidden="true"
          className="flex size-10 items-center justify-center rounded-[10px] bg-brand text-on-brand"
        >
          <Hash className="size-5" />
        </span>
        <h1 className="text-2xl font-semibold text-fg">{t.join.title}</h1>
        <p className="text-sm text-fg-secondary">{t.join.subtitle}</p>
      </div>

      <form action={formAction} className="flex flex-col gap-7" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="join-name" className="text-fg">
            {t.join.name}
          </Label>
          <Input
            id="join-name"
            name="name"
            autoComplete="nickname"
            defaultValue={error?.values.name}
            aria-invalid={error ? true : undefined}
            aria-describedby={
              error ? 'join-name-hint join-name-error' : 'join-name-hint'
            }
            className="h-12 rounded-[10px] bg-surface px-4 text-fg"
          />
          <p id="join-name-hint" className="text-xs text-fg-secondary">
            {t.join.nameHint}
          </p>
          {error && (
            <p id="join-name-error" className="text-sm text-destructive">
              {error.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={pending}
          className="h-12 w-full rounded-[10px]"
        >
          {pending ? t.join.submitting : t.join.submit}
        </Button>
      </form>

      <p className="text-center text-xs text-fg-secondary">{t.join.help}</p>
    </div>
  );
}
