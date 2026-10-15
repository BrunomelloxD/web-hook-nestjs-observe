import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn } from 'storybook/test';
import { chatDictionary as t } from '../chat.dictionary';
import { carlos, makeMessage, me } from '../test-fixtures';
import { MessageBubble } from './message-bubble';

const meta = {
  title: 'Chat/MessageBubble',
  component: MessageBubble,
  args: {
    message: makeMessage({
      author: carlos,
      content: 'Opa, Ana! Cheguei agora. Como tá o dia?',
      createdAt: '2026-10-14T17:05:00.000Z',
    }),
    own: false,
  },
} satisfies Meta<typeof MessageBubble>;

export default meta;
type Story = StoryObj<typeof meta>;

const ownMessage = makeMessage({
  author: me,
  content: 'E aí, galera! Primeira vez aqui no chat.',
  createdAt: '2026-10-14T17:31:00.000Z',
});

export const DosOutros: Story = { name: 'Dos outros' };
export const Propria: Story = {
  name: 'Própria',
  args: { message: ownMessage, own: true },
};
export const PalavraLonga: Story = {
  name: 'Palavra longa',
  args: { message: makeMessage({ content: 'a'.repeat(1000) }) },
};
export const Enviando: Story = {
  args: { message: ownMessage, own: true, status: 'sending' },
};
export const Falhou: Story = {
  name: 'Falhou (Tentar de novo)',
  args: { message: ownMessage, own: true, status: 'failed', onRetry: fn() },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: t.message.retry }),
    );
    await expect(args.onRetry).toHaveBeenCalledOnce();
  },
};
