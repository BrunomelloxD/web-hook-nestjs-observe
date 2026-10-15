'use client';

// Next requires a Client Component here; exempt from the .client.tsx suffix.
import { Button } from '@/components/ui/button';
import { chatDictionary as t } from '@/features/chat/client';

export default function ChatError({ retry }: { retry: () => void }) {
  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-4 bg-page p-6">
      <p role="alert" className="text-fg">
        {t.room.loadError}
      </p>
      <Button onClick={() => retry()}>{t.room.retry}</Button>
    </main>
  );
}
