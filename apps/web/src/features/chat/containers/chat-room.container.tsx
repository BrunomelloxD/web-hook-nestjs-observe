import { redirect } from 'next/navigation';
import { ChatStream } from '../components/chat-stream.client';
import { getMessages } from '../queries/get-messages';
import type { SendMessageAction } from '../schemas/message.schema';
import { getValidSession } from '../session/get-valid-session';

export type ChatRoomContainerProps = {
  /** Server Actions from the page, passed down to the client components. */
  actions: { send: SendMessageAction; leave: () => Promise<void> };
};

/** Must be rendered inside <Suspense>. */
export async function ChatRoomContainer({ actions }: ChatRoomContainerProps) {
  const valid = await getValidSession();
  // Server Components can't delete cookies: the route handler does it.
  if (!valid) redirect('/session/end');

  const { me, online } = valid;
  const messages = await getMessages({ limit: 50 });

  return (
    <ChatStream
      me={me}
      initialMessages={messages}
      initialOnline={online.total}
      actions={actions}
    />
  );
}
