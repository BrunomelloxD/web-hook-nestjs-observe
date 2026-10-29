import { render, screen } from '@testing-library/react';
import {
  leave,
  loadOlderMessages,
  notifyTyping,
  sendMessage,
} from '@/features/chat';
import ChatPage from './page';

const containerProps = vi.hoisted(() => vi.fn());

// Feature parts are tested on their own.
vi.mock('@/features/chat', () => ({
  sendMessage: vi.fn(),
  leave: vi.fn(),
  notifyTyping: vi.fn(),
  loadOlderMessages: vi.fn(),
  ChatRoomContainer: (props: unknown) => {
    containerProps(props);
    return <div>sala</div>;
  },
}));

describe('ChatPage', () => {
  it('passa sendMessage, leave, notifyTyping e loadOlderMessages ao ChatRoomContainer', () => {
    render(<ChatPage />);

    expect(screen.getByText('sala')).toBeInTheDocument();
    expect(containerProps).toHaveBeenCalledWith({
      actions: {
        send: sendMessage,
        leave,
        typing: notifyTyping,
        loadOlder: loadOlderMessages,
      },
    });
  });
});
