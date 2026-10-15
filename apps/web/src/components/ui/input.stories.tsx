import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Input } from './input';

const meta = {
  title: 'UI/Input',
  component: Input,
  args: { 'aria-label': 'Campo', placeholder: 'Digite aqui' },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithValue: Story = { args: { defaultValue: 'Valor preenchido' } };
export const Invalid: Story = {
  args: { 'aria-invalid': true, defaultValue: 'inválido' },
};
export const Disabled: Story = { args: { disabled: true } };
