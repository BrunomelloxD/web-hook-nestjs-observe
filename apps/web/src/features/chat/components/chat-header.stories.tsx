import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn } from 'storybook/test';
import { chatDictionary as t } from '../chat.dictionary';
import { me } from '../test-fixtures';
import { ChatHeader } from './chat-header';

const meta = {
  title: 'Chat/ChatHeader',
  component: ChatHeader,
  args: { me, online: 8, leaveAction: fn(async () => {}) },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ChatHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mobile: Story = {
  globals: { viewport: { value: 'mobile', isRotated: false } },
};
export const Desktop: Story = {
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: t.room.leave }));
    await expect(args.leaveAction).toHaveBeenCalledOnce();
  },
};
