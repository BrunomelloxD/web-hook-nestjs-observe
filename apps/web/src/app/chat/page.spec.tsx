import { render, screen } from '@testing-library/react';
import { leave, sendMessage } from '@/features/chat';
import ChatPage from './page';

const containerProps = vi.hoisted(() => vi.fn());

// Feature parts are tested on their own.
vi.mock('@/features/chat', () => ({
  sendMessage: vi.fn(),
  leave: vi.fn(),
  ChatRoomContainer: (props: unknown) => {
    containerProps(props);
    return <div>sala</div>;
  },
}));

describe('ChatPage', () => {
  it('passa sendMessage e leave ao ChatRoomContainer', () => {
    render(<ChatPage />);

    expect(screen.getByText('sala')).toBeInTheDocument();
    expect(containerProps).toHaveBeenCalledWith({
      actions: { send: sendMessage, leave },
    });
  });
});
