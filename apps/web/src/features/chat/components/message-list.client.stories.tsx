import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useEffect, useState, type ComponentProps } from 'react';
import { expect, fn, waitFor } from 'storybook/test';
import { chatDictionary as t } from '../chat.dictionary';
import type { ChatItem } from '../state/chat-room.reducer';
import {
  ana,
  asItems,
  carlos,
  makeConversation,
  makeMessage,
  me,
} from '../test-fixtures';
import { MessageList } from './message-list.client';
import { TypingIndicator } from './typing-indicator';

const meta = {
  title: 'Chat/MessageList',
  component: MessageList,
  args: { items: asItems(makeConversation()), meId: me.id },
  decorators: [
    // The Sala gives the list a fixed height; this mimics it.
    // tabIndex: a scrollable region must be reachable by keyboard (axe).
    (Story) => (
      <div
        tabIndex={0}
        className="h-[480px] overflow-y-auto rounded-lg border border-line"
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MessageList>;

export default meta;
type Story = StoryObj<typeof meta>;

function pending(
  status: 'sending' | 'failed',
  content = 'Acabei de mandar isto.',
): ChatItem {
  return {
    kind: 'pending',
    clientId: `c0000000-0000-4000-8000-00000000000${status === 'sending' ? 1 : 2}`,
    content,
    createdAt: '2026-10-14T17:40:00.000Z',
    status,
  };
}

const longConversation = Array.from({ length: 30 }, (_, i) =>
  makeMessage({
    id: `long-${i}`,
    seq: i + 1,
    author: [ana, carlos, me][i % 3],
    content: `Mensagem número ${i + 1} da conversa.`,
    createdAt: `2026-10-14T17:${String(i).padStart(2, '0')}:00.000Z`,
  }),
);

export const Vazia: Story = { args: { items: [] } };
export const Longa: Story = {
  name: 'Longa (rolável)',
  args: { items: asItems(longConversation) },
  play: async ({ canvas, canvasElement }) => {
    const scroller = canvasElement.querySelector('.overflow-y-auto')!;
    await expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);
    // Opens on the last message (ROOM-01 AC2).
    await expect(
      scroller.scrollTop + scroller.clientHeight,
    ).toBeGreaterThanOrEqual(scroller.scrollHeight - 1);
    await expect(
      canvas.getByText('Mensagem número 30 da conversa.'),
    ).toBeVisible();
  },
};
export const PropriasEDosOutros: Story = {
  name: 'Próprias e dos outros',
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('list')).toHaveAttribute(
      'aria-live',
      'polite',
    );
  },
};
export const MensagemDeSistema: Story = {
  name: 'Mensagem de sistema',
  args: {
    items: asItems([
      makeMessage({ id: 'j', type: 'JOINED', content: '', author: ana }),
      makeMessage({ id: 'l', type: 'LEFT', content: '', author: carlos }),
    ]),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(t.system.left('Carlos'))).toBeVisible();
  },
};
export const ComDigitando: Story = {
  name: 'Com digitando',
  args: { footer: <TypingIndicator names={['Carlos']} /> },
};
export const Enviando: Story = {
  args: { items: [...asItems(makeConversation()), pending('sending')] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(t.message.sending)).toBeVisible();
  },
};
export const NaoEnviada: Story = {
  name: 'Não enviada',
  args: {
    items: [...asItems(makeConversation()), pending('failed')],
    onRetry: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.getByText(t.message.failed)).toBeVisible();
    await userEvent.click(
      canvas.getByRole('button', { name: t.message.retry }),
    );
    await expect(args.onRetry).toHaveBeenCalledWith(
      'c0000000-0000-4000-8000-000000000002',
    );
  },
};

// `play` adds a message the way the Sala's state does, by a new items prop.
const novaMensagem = new EventTarget();

function ListWithLiveMessages(props: ComponentProps<typeof MessageList>) {
  const [items, setItems] = useState(props.items);
  useEffect(() => {
    const add = () =>
      setItems((current) => [
        ...current,
        ...asItems([
          makeMessage({
            id: 'live-31',
            seq: 31,
            author: carlos,
            content: 'Mensagem nova enquanto você lia.',
            createdAt: '2026-10-14T17:40:00.000Z',
          }),
        ]),
      ]);
    novaMensagem.addEventListener('add', add);
    return () => novaMensagem.removeEventListener('add', add);
  }, []);
  return <MessageList {...props} items={items} />;
}

export const NovasMensagens: Story = {
  name: 'Novas mensagens ↓',
  args: { items: asItems(longConversation) },
  render: (args) => <ListWithLiveMessages {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const scroller = canvasElement.querySelector('.overflow-y-auto')!;
    const distanceToBottom = () =>
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;

    // Reading older messages, far from the bottom.
    const scrolled = new Promise((resolve) =>
      scroller.addEventListener('scroll', resolve, { once: true }),
    );
    scroller.scrollTop = 0;
    await scrolled;
    await expect(distanceToBottom()).toBeGreaterThan(80);
    novaMensagem.dispatchEvent(new Event('add'));

    const button = await canvas.findByRole('button', {
      name: t.room.newMessages,
    });
    await expect(button).toBeVisible();
    await expect(scroller.scrollTop).toBe(0);

    await userEvent.click(button);

    await waitFor(() => expect(distanceToBottom()).toBeLessThanOrEqual(1));
    await expect(
      canvas.getByText('Mensagem nova enquanto você lia.'),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        canvas.queryByRole('button', { name: t.room.newMessages }),
      ).toBeNull(),
    );
  },
};

const olderPage = Array.from({ length: 30 }, (_, i) =>
  makeMessage({
    id: `older-${i}`,
    seq: i + 1,
    author: [carlos, ana, me][i % 3],
    content: `Mensagem anterior ${i + 1}.`,
    createdAt: `2026-10-14T16:${String(i).padStart(2, '0')}:00.000Z`,
  }),
);
const newerPage = longConversation.map((message) => ({
  ...message,
  seq: message.seq + 30,
}));

export const ComAnteriores: Story = {
  name: 'Com mensagens anteriores',
  args: {
    items: asItems(newerPage),
    history: { hasMore: true, status: 'idle', onLoad: fn() },
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: t.room.loadOlder }),
    );
    await expect(args.history?.onLoad).toHaveBeenCalledOnce();
  },
};
export const CarregandoAnteriores: Story = {
  name: 'Carregando anteriores',
  args: {
    items: asItems(newerPage),
    history: { hasMore: true, status: 'loading', onLoad: fn() },
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('button', { name: t.room.loadingOlder }),
    ).toBeDisabled();
  },
};
export const ErroAoCarregarAnteriores: Story = {
  name: 'Erro ao carregar anteriores',
  args: {
    items: asItems(newerPage),
    history: { hasMore: true, status: 'error', onLoad: fn() },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      t.errors.loadOlderFailed,
    );
    await expect(
      canvas.getByRole('button', { name: t.room.loadOlder }),
    ).toBeEnabled();
  },
};

// Loads the older page the way the Sala does: loading, then the items on top.
function ListWithOlderMessages(props: ComponentProps<typeof MessageList>) {
  const [items, setItems] = useState(props.items);
  const [status, setStatus] = useState<'idle' | 'loading'>('idle');
  const [hasMore, setHasMore] = useState(true);
  function onLoad() {
    setStatus('loading');
    setTimeout(() => {
      setItems((current) => [...asItems(olderPage), ...current]);
      setHasMore(false);
      setStatus('idle');
    }, 100);
  }
  return (
    <MessageList
      {...props}
      items={items}
      history={{ hasMore, status, onLoad }}
    />
  );
}

export const CarregarAnteriores: Story = {
  name: 'Carregar anteriores mantém a leitura',
  args: { items: asItems(newerPage) },
  render: (args) => <ListWithOlderMessages {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const scroller = canvasElement.querySelector('.overflow-y-auto')!;
    const scrolled = new Promise((resolve) =>
      scroller.addEventListener('scroll', resolve, { once: true }),
    );
    scroller.scrollTop = 0;
    await scrolled;
    const top = canvas.getByText('Mensagem número 1 da conversa.');
    const offset = () =>
      top.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    const before = offset();

    await userEvent.click(
      canvas.getByRole('button', { name: t.room.loadOlder }),
    );
    await canvas.findByText('Mensagem anterior 1.');

    // The message that was at the top stays where it was (HIST-01 AC3).
    await expect(Math.abs(offset() - before)).toBeLessThanOrEqual(1);
    await expect(offset()).toBeGreaterThanOrEqual(0);
    await expect(offset()).toBeLessThan(scroller.clientHeight);
    await expect(scroller.scrollTop).toBeGreaterThan(0);
    await expect(
      canvas.queryByRole('button', { name: t.room.newMessages }),
    ).toBeNull();
    await expect(
      canvas.queryByRole('button', { name: t.room.loadOlder }),
    ).toBeNull();
  },
};
