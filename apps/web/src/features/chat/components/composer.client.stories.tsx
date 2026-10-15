import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn } from 'storybook/test';
import { chatDictionary as t } from '../chat.dictionary';
import type { SendMessageAction } from '../schemas/message.schema';
import { makeMessage } from '../test-fixtures';
import { Composer } from './composer.client';

// Server Actions don't run in Storybook: each story passes a fake result.
const meta = {
  title: 'Chat/Composer',
  component: Composer,
  args: {
    send: fn<SendMessageAction>(async () => ({
      ok: true,
      message: makeMessage(),
    })),
  },
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
    await expect(args.send).toHaveBeenCalledWith({
      content: 'Oi!',
      clientId: expect.any(String),
    });
    await expect(field).toHaveValue('');
  },
};
export const Enviando: Story = {
  args: { send: fn<SendMessageAction>(() => new Promise(() => {})) },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(
      canvas.getByRole('textbox', { name: t.composer.label }),
      'Oi!{Enter}',
    );
    await expect(
      canvas.getByRole('button', { name: t.composer.send }),
    ).toBeDisabled();
  },
};
export const ErroDeEnvio: Story = {
  name: 'Erro de envio',
  args: {
    send: fn<SendMessageAction>(async () => ({
      ok: false,
      reason: 'unexpected',
    })),
  },
  play: async ({ canvas, userEvent }) => {
    const field = canvas.getByRole('textbox', { name: t.composer.label });
    await userEvent.type(field, 'Oi!{Enter}');
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      t.errors.send,
    );
    await expect(field).toHaveValue('Oi!');
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
    await expect(args.send).not.toHaveBeenCalled();
  },
};
export const ComAviso: Story = {
  name: 'Com aviso',
  args: { notice: t.errors.reconnecting },
};
