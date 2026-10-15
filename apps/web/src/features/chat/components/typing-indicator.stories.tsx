import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { TypingIndicator } from './typing-indicator';

const meta = {
  title: 'Chat/TypingIndicator',
  component: TypingIndicator,
  args: { names: ['Carlos'] },
} satisfies Meta<typeof TypingIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UmaPessoa: Story = { name: '1 pessoa' };
export const DuasPessoas: Story = {
  name: '2 pessoas',
  args: { names: ['Ana', 'Carlos'] },
};
export const VariasPessoas: Story = {
  name: '3+ pessoas',
  args: { names: ['Ana', 'Carlos', 'Bia'] },
};
