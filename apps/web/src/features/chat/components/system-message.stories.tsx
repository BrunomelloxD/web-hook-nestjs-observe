import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { chatDictionary as t } from '../chat.dictionary';
import { SystemMessage } from './system-message';

const meta = {
  title: 'Chat/SystemMessage',
  component: SystemMessage,
  args: { text: t.system.joined('Ana') },
} satisfies Meta<typeof SystemMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MensagemDeSistema: Story = { name: 'Mensagem de sistema' };
export const Saida: Story = { args: { text: t.system.left('Carlos') } };
