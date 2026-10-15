import { ThemeToggle } from '@/components/ui/theme-toggle.client';
import { chatDictionary as t, join, JoinForm } from '@/features/chat';

// Static: the proxy sends whoever has a session to /chat (AD-002).
export default function JoinPage() {
  return (
    <main className="relative flex min-h-dvh flex-1 items-center justify-center bg-page p-4 md:p-6">
      <div className="absolute top-4 right-4 md:top-6 md:right-6">
        <ThemeToggle labels={t.theme} />
      </div>
      <JoinForm action={join} />
    </main>
  );
}
