import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn } from 'storybook/test';
import { chatDictionary as t } from '../chat.dictionary';
import { asItems, makeConversation, me } from '../test-fixtures';
import { ChatHeader } from './chat-header';
import { ChatRoomView } from './chat-room-view';
import { Composer } from './composer.client';
import { MessageList } from './message-list.client';
import { TypingIndicator } from './typing-indicator';

// The Sala frames of the design file: Sala · Faixa · Tema (3 × 2).
const meta = {
  title: 'Chat/Telas/Sala',
  component: ChatRoomView,
  args: {
    header: <ChatHeader me={me} online={8} leaveAction={fn(async () => {})} />,
    list: (
      <MessageList
        items={asItems(makeConversation())}
        meId={me.id}
        footer={<TypingIndicator names={['Carlos']} />}
      />
    ),
    composer: <Composer onSend={fn()} />,
  },
  parameters: { layout: 'fullscreen' },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('main', { name: t.room.messages }),
    ).toContainElement(canvas.getByRole('list', { name: t.room.messages }));
  },
} satisfies Meta<typeof ChatRoomView>;

export default meta;
type Story = StoryObj<typeof meta>;

function screenGlobals(viewport: string, theme: 'light' | 'dark') {
  return { theme, viewport: { value: viewport, isRotated: false } };
}

export const MobileLight: Story = {
  name: 'Sala · Mobile · Light',
  globals: screenGlobals('mobile', 'light'),
};
export const MobileDark: Story = {
  name: 'Sala · Mobile · Dark',
  globals: screenGlobals('mobile', 'dark'),
};
export const TabletLight: Story = {
  name: 'Sala · Tablet · Light',
  globals: screenGlobals('tablet', 'light'),
};
export const TabletDark: Story = {
  name: 'Sala · Tablet · Dark',
  globals: screenGlobals('tablet', 'dark'),
};
export const DesktopLight: Story = {
  name: 'Sala · Desktop · Light',
  globals: screenGlobals('desktop', 'light'),
};
export const DesktopDark: Story = {
  name: 'Sala · Desktop · Dark',
  globals: screenGlobals('desktop', 'dark'),
};
