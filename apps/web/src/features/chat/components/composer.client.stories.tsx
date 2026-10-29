import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn } from 'storybook/test';
import { chatDictionary as t } from '../chat.dictionary';
import { Composer } from './composer.client';

const meta = {
  title: 'Chat/Composer',
  component: Composer,
  args: { onSend: fn() },
} satisfies Meta<typeof Composer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Padrao: Story = {
  name: 'Padrão',
  play: async ({ args, canvas, userEvent }) => {
    const field = canvas.getByRole('textbox', { name: t.composer.label });
    await expect(
      canvas.getByRole('button', { name: t.composer.send }),
    ).toBeDisabled();
    await userEvent.type(field, 'Oi!{Enter}');
    await expect(args.onSend).toHaveBeenCalledWith({
      content: 'Oi!',
      clientId: expect.any(String),
    });
    await expect(field).toHaveValue('');
  },
};
export const AvisoDeLimite: Story = {
  name: 'Aviso de limite',
  args: { error: t.errors.rateLimited },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      t.errors.rateLimited,
    );
  },
};
export const LongaDemais: Story = {
  name: 'Longa demais',
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('textbox', { name: t.composer.label }),
    );
    await userEvent.paste('a'.repeat(1001));
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      t.errors.messageTooLong,
    );
    await expect(
      canvas.getByRole('button', { name: t.composer.send }),
    ).toBeDisabled();
    await expect(args.onSend).not.toHaveBeenCalled();
  },
};
export const ComAviso: Story = {
  name: 'Com aviso',
  args: { notice: t.errors.reconnecting },
};
export const Digitando: Story = {
  name: 'Digitando',
  args: { onTyping: fn() },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(
      canvas.getByRole('textbox', { name: t.composer.label }),
      'Oi, tudo bem?',
    );
    // Many keystrokes within 3 s: one notice (TYPE-01 AC1).
    await expect(args.onTyping).toHaveBeenCalledTimes(1);
  },
};
