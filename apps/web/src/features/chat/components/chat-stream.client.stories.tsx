import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn } from 'storybook/test';
import { fakeEventSources } from '../../../../test/fake-event-source';
import { chatDictionary as t } from '../chat.dictionary';
import type { SendMessageAction } from '../schemas/message.schema';
import {
  ana,
  carlos,
  makeConversation,
  makeMessage,
  me,
} from '../test-fixtures';
import { ChatStream } from './chat-stream.client';

// One fake stream per story, so `play` can emit on the source it opened.
const padrao = fakeEventSources();
const aoVivo = fakeEventSources();
const reconectando = fakeEventSources();
const digitandoUm = fakeEventSources();
const digitandoDois = fakeEventSources();
const digitandoVarios = fakeEventSources();

function lastSource(sources: ReturnType<typeof fakeEventSources>) {
  return sources.instances.at(-1)!;
}

const meta = {
  title: 'Chat/ChatStream',
  component: ChatStream,
  args: {
    me,
    initialMessages: makeConversation(),
    initialOnline: 3,
    actions: {
      send: fn<SendMessageAction>(async () => ({
        ok: true,
        message: makeMessage(),
      })),
      leave: fn(async () => {}),
    },
    createEventSource: padrao.create,
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ChatStream>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Padrao: Story = {
  name: 'Padrão',
  play: async ({ canvas }) => {
    // makeConversation() ends at seq 6 (RECON-01 AC8).
    await expect(lastSource(padrao).url).toBe('/chat/stream?after=6');
    await expect(canvas.getByText(t.online(3))).toBeVisible();
  },
};

export const AoVivo: Story = {
  name: 'Ao vivo',
  args: { createEventSource: aoVivo.create },
  play: async ({ canvas }) => {
    const source = lastSource(aoVivo);
    const live = makeMessage({
      id: 'm0000000-0000-4000-8000-000000000007',
      seq: 7,
      author: carlos,
      content: 'Chegou pelo SSE!',
      createdAt: '2026-10-14T17:33:00.000Z',
    });

    source.emit('message', live);
    // A replay of the same seq is ignored.
    source.emit('message', live);
    source.emit('presence', { online: 4 });

    await expect(await canvas.findByText(t.online(4))).toBeVisible();
    await expect(canvas.getAllByText('Chegou pelo SSE!')).toHaveLength(1);
    const items = canvas
      .getByRole('list', { name: t.room.messages })
      .querySelectorAll('li');
    await expect(items[items.length - 1]).toHaveTextContent('Chegou pelo SSE!');
    await expect(
      canvas.getByText(t.system.joined(ana.name)),
    ).toBeInTheDocument();
  },
};

async function sendOla({
  canvas,
  userEvent,
}: Parameters<NonNullable<Story['play']>>[0]) {
  await userEvent.type(
    canvas.getByRole('textbox', { name: t.composer.label }),
    'Olá!{Enter}',
  );
}

export const Enviando: Story = {
  args: {
    actions: {
      // Never answers: the message stays as "Enviando…".
      send: fn<SendMessageAction>(() => new Promise(() => {})),
      leave: fn(async () => {}),
    },
  },
  play: async (context) => {
    await sendOla(context);
    await expect(
      await context.canvas.findByText(t.message.sending),
    ).toBeVisible();
  },
};

export const Falha: Story = {
  args: {
    actions: {
      send: fn<SendMessageAction>(async () => ({
        ok: false,
        reason: 'unexpected',
      })),
      leave: fn(async () => {}),
    },
  },
  play: async (context) => {
    await sendOla(context);
    await expect(
      await context.canvas.findByText(t.message.failed),
    ).toBeVisible();
    await expect(
      context.canvas.getByRole('button', { name: t.message.retry }),
    ).toBeVisible();
  },
};

export const Limite: Story = {
  args: {
    actions: {
      send: fn<SendMessageAction>(async () => ({
        ok: false,
        reason: 'rate_limited',
        retryAfter: 4,
      })),
      leave: fn(async () => {}),
    },
  },
  play: async (context) => {
    await sendOla(context);
    await expect(await context.canvas.findByRole('alert')).toHaveTextContent(
      t.errors.rateLimited,
    );
    await expect(context.canvas.getByText(t.message.failed)).toBeVisible();
  },
};

export const Reconectando: Story = {
  args: { createEventSource: reconectando.create },
  play: async ({ canvas }) => {
    lastSource(reconectando).dispatchEvent(new Event('error'));
    await expect(await canvas.findByText(t.errors.reconnecting)).toBeVisible();
  },
};

const bia = { id: 'a1b2c3d4-0000-4000-8000-000000000004', name: 'Bia' };

/** Emits `typing` for each participant on the story's stream. */
function typing(
  sources: ReturnType<typeof fakeEventSources>,
  ...participants: { id: string; name: string }[]
) {
  for (const participant of participants) {
    lastSource(sources).emit('typing', { participant });
  }
}

export const DigitandoUm: Story = {
  name: 'Digitando (1)',
  args: { createEventSource: digitandoUm.create },
  play: async ({ canvas }) => {
    typing(digitandoUm, ana);
    await expect(await canvas.findByText(t.typing(['Ana']))).toBeVisible();
  },
};

export const DigitandoDois: Story = {
  name: 'Digitando (2)',
  args: { createEventSource: digitandoDois.create },
  play: async ({ canvas }) => {
    typing(digitandoDois, ana, carlos);
    await expect(
      await canvas.findByText(t.typing(['Ana', 'Carlos'])),
    ).toBeVisible();
  },
};

export const DigitandoVarios: Story = {
  name: 'Digitando (3+)',
  args: { createEventSource: digitandoVarios.create },
  play: async ({ canvas }) => {
    typing(digitandoVarios, ana, carlos, bia);
    await expect(
      await canvas.findByText(t.typing(['Ana', 'Carlos', 'Bia'])),
    ).toBeVisible();
  },
};

/** A full first page (seq 51-100), so the room has older messages. */
const fullPage = Array.from({ length: 50 }, (_, i) =>
  makeMessage({
    id: `m0000000-0000-4000-8000-${String(51 + i).padStart(12, '0')}`,
    seq: 51 + i,
    author: [ana, carlos, me][i % 3],
    content: `Mensagem ${51 + i}.`,
  }),
);

export const CarregandoAnteriores: Story = {
  name: 'Carregando anteriores',
  args: {
    initialMessages: fullPage,
    actions: {
      send: fn<SendMessageAction>(async () => ({
        ok: true,
        message: makeMessage(),
      })),
      leave: fn(async () => {}),
      // Never answers: the button stays as "Carregando…".
      loadOlder: fn(() => new Promise<never>(() => {})),
    },
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: t.room.loadOlder }),
    );
    await expect(args.actions.loadOlder).toHaveBeenCalledWith(51);
    await expect(
      await canvas.findByRole('button', { name: t.room.loadingOlder }),
    ).toBeDisabled();
  },
};
