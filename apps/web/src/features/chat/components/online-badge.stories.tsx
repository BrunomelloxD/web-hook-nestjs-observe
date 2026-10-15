import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { OnlineBadge } from './online-badge';

const meta = {
  title: 'Chat/OnlineBadge',
  component: OnlineBadge,
  args: { count: 8 },
} satisfies Meta<typeof OnlineBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UmaPessoa: Story = { name: '1 pessoa', args: { count: 1 } };
export const VariasPessoas: Story = { name: 'N pessoas' };
