import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Avatar } from './avatar';

const meta = {
  title: 'UI/Avatar',
  component: Avatar,
  args: { name: 'Ana', colorSeed: 'a' },
  argTypes: {
    tone: { control: 'inline-radio', options: ['auto', 'brand'] },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
  },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pink: Story = {};
export const Green: Story = { args: { name: 'Carlos', colorSeed: 'b' } };
export const Brand: Story = { args: { name: 'Você', tone: 'brand' } };
export const Small: Story = { args: { size: 'sm' } };
export const AccentedName: Story = { args: { name: 'érica' } };
