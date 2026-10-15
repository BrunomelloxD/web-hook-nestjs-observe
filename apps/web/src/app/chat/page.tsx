import { Suspense } from 'react';
import { ChatRoomContainer, leave, sendMessage } from '@/features/chat';

export default function ChatPage() {
  return (
    // Session and messages are request-time data: they stay inside Suspense.
    <Suspense fallback={<div aria-busy="true" className="h-dvh bg-page" />}>
      <ChatRoomContainer actions={{ send: sendMessage, leave }} />
    </Suspense>
  );
}
