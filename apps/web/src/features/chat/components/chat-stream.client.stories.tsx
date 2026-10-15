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
    await expect(lastSource(padrao).url).toBe('/chat/stream');
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
