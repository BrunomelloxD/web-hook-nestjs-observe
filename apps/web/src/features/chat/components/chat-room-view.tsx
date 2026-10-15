import type { ReactNode } from 'react';
import { chatDictionary as t } from '../chat.dictionary';

type ChatRoomViewProps = {
  header: ReactNode;
  list: ReactNode;
  composer: ReactNode;
};

const COLUMN = 'xl:mx-auto xl:max-w-[800px]';

/** Sala layout: header and composer stay put, only the list scrolls (UI-02). */
export function ChatRoomView({ header, list, composer }: ChatRoomViewProps) {
  return (
    <div className="flex h-dvh flex-col bg-page">
      <div className="shrink-0">{header}</div>
      {/* tabIndex: a scrollable region must be reachable by keyboard (axe). */}
      <main
        tabIndex={0}
        aria-label={t.room.messages}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <div className={`h-full ${COLUMN}`}>{list}</div>
      </main>
      <div
        data-testid="composer-slot"
        className="shrink-0 border-t border-line bg-surface px-4 py-3"
      >
        <div className={COLUMN}>{composer}</div>
      </div>
    </div>
  );
}
