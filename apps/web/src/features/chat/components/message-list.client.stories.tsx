import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import { chatDictionary as t } from '../chat.dictionary';
import {
  ana,
  carlos,
  makeConversation,
  makeMessage,
  me,
} from '../test-fixtures';
import { MessageList } from './message-list.client';
import { TypingIndicator } from './typing-indicator';

const meta = {
  title: 'Chat/MessageList',
  component: MessageList,
  args: { messages: makeConversation(), meId: me.id },
  decorators: [
    // The Sala gives the list a fixed height; this mimics it.
    // tabIndex: a scrollable region must be reachable by keyboard (axe).
    (Story) => (
      <div
        tabIndex={0}
        className="h-[480px] overflow-y-auto rounded-lg border border-line"
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MessageList>;

export default meta;
type Story = StoryObj<typeof meta>;

const longConversation = Array.from({ length: 30 }, (_, i) =>
  makeMessage({
    id: `long-${i}`,
    seq: i + 1,
    author: [ana, carlos, me][i % 3],
    content: `Mensagem número ${i + 1} da conversa.`,
    createdAt: `2026-10-14T17:${String(i).padStart(2, '0')}:00.000Z`,
  }),
);

export const Vazia: Story = { args: { messages: [] } };
export const Longa: Story = {
  name: 'Longa (rolável)',
  args: { messages: longConversation },
  play: async ({ canvas, canvasElement }) => {
    const scroller = canvasElement.querySelector('.overflow-y-auto')!;
    await expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);
    // Opens on the last message (ROOM-01 AC2).
    await expect(
      scroller.scrollTop + scroller.clientHeight,
    ).toBeGreaterThanOrEqual(scroller.scrollHeight - 1);
    await expect(
      canvas.getByText('Mensagem número 30 da conversa.'),
    ).toBeVisible();
  },
};
export const PropriasEDosOutros: Story = {
  name: 'Próprias e dos outros',
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('list')).toHaveAttribute(
      'aria-live',
      'polite',
    );
  },
};
export const MensagemDeSistema: Story = {
  name: 'Mensagem de sistema',
  args: {
    messages: [
      makeMessage({ id: 'j', type: 'JOINED', content: '', author: ana }),
      makeMessage({ id: 'l', type: 'LEFT', content: '', author: carlos }),
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(t.system.left('Carlos'))).toBeVisible();
  },
};
export const ComDigitando: Story = {
  name: 'Com digitando',
  args: { footer: <TypingIndicator names={['Carlos']} /> },
};
