import { Hash } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle.client';
import { chatDictionary as t } from '../chat.dictionary';
import type { ChatParticipant } from '../chat.types';
import { OnlineBadge } from './online-badge';

type ChatHeaderProps = {
  me: ChatParticipant;
  online: number;
  /** Server Action by props, so tests and stories can pass a fake. */
  leaveAction: () => Promise<void>;
};

export function ChatHeader({ me, online, leaveAction }: ChatHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-line bg-surface px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-soft text-brand-text"
        >
          <Hash className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="text-[15px] font-semibold text-fg">{t.room.title}</h1>
          <OnlineBadge count={online} />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="flex items-center gap-2.5">
          <Avatar name={me.name} colorSeed={me.id} tone="brand" />
          {/* Below 768 px only the avatar shows (UI-02 AC6). */}
          <span className="hidden text-sm font-medium text-fg md:inline">
            {me.name}
          </span>
        </span>
        <ThemeToggle labels={t.theme} />
        <form action={leaveAction}>
          <Button type="submit" variant="outline">
            {t.room.leave}
          </Button>
        </form>
      </div>
    </header>
  );
}
