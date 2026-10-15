import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeEventSources } from '../../../../test/fake-event-source';
import type { SendMessageAction } from '../schemas/message.schema';
import { ana, carlos, makeMessage, me } from '../test-fixtures';
import { ChatStream } from './chat-stream.client';

const initialMessages = [
  makeMessage({ id: 'm-1', seq: 1, author: ana, content: 'primeira' }),
  makeMessage({ id: 'm-3', seq: 3, author: carlos, content: 'terceira' }),
];

function actions() {
  return {
    send: vi.fn<SendMessageAction>(async () => ({
      ok: true,
      message: makeMessage(),
    })),
    leave: vi.fn(async () => {}),
  };
}

function renderStream(props: Partial<Parameters<typeof ChatStream>[0]> = {}) {
  const sources = fakeEventSources();
  const acts = actions();
  const view = render(
    <ChatStream
      me={me}
      initialMessages={initialMessages}
      initialOnline={2}
      actions={acts}
      createEventSource={sources.create}
      {...props}
    />,
  );
  /** Emits on the one open stream, as the browser would. */
  const emit = (type: string, data: unknown) =>
    act(() => sources.instances[0]!.emit(type, data));
  return { ...view, sources, actions: acts, emit };
}

function contents() {
  return within(screen.getByRole('list', { name: 'Mensagens' }))
    .getAllByTestId('message-content')
    .map((node) => node.textContent);
}

describe('ChatStream', () => {
  it('mostra as mensagens e o online iniciais', () => {
    renderStream();

    expect(contents()).toEqual(['primeira', 'terceira']);
    expect(
      within(screen.getByRole('banner')).getByText('2 pessoas online'),
    ).toBeInTheDocument();
  });

  it('abre um único EventSource para /chat/stream e o fecha ao desmontar (SSE-02 AC8)', () => {
    const { sources, unmount } = renderStream();

    expect(sources.instances.map((source) => source.url)).toEqual([
      '/chat/stream',
    ]);
    expect(sources.instances[0]!.closed).toBe(false);

    unmount();

    expect(sources.instances[0]!.closed).toBe(true);
  });

  it('evento "message" entra na lista na posição do seq (SSE-02 AC9)', () => {
    const { emit } = renderStream();

    emit(
      'message',
      makeMessage({ id: 'm-2', seq: 2, author: ana, content: 'segunda' }),
    );
    emit(
      'message',
      makeMessage({ id: 'm-4', seq: 4, author: carlos, content: 'quarta' }),
    );

    expect(contents()).toEqual(['primeira', 'segunda', 'terceira', 'quarta']);
  });

  it('o mesmo evento duas vezes aparece uma vez só (SSE-02 AC10)', () => {
    const { emit } = renderStream();
    const live = makeMessage({ id: 'm-5', seq: 5, content: 'só uma vez' });

    emit('message', live);
    emit('message', live);

    expect(contents()).toEqual(['primeira', 'terceira', 'só uma vez']);
  });

  it('seq já presente na lista inicial é ignorado (SSE-02 AC10)', () => {
    const { emit } = renderStream();

    emit('message', makeMessage({ id: 'm-3', seq: 3, content: 'repetida' }));

    expect(contents()).toEqual(['primeira', 'terceira']);
  });

  it('a própria mensagem chega pelo SSE e aparece à direita', () => {
    const { emit } = renderStream();

    emit(
      'message',
      makeMessage({ id: 'm-6', seq: 6, author: me, content: 'minha' }),
    );

    const bubble = screen
      .getByText('minha')
      .closest('[data-testid="message-bubble"]')!;
    expect(bubble).toHaveClass('justify-end');
  });

  it('evento "presence" com 4 → "4 pessoas online" (SSE-02 AC11)', () => {
    const { emit } = renderStream();

    emit('presence', { online: 4 });

    const header = screen.getByRole('banner');
    expect(within(header).getByText('4 pessoas online')).toBeInTheDocument();
    expect(within(header).queryByText('2 pessoas online')).toBeNull();
  });

  it('o Composer envia pela action send e nada mais acontece na lista', async () => {
    const { actions: acts, sources } = renderStream();

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Mensagem' }),
      'olá{Enter}',
    );

    expect(acts.send).toHaveBeenCalledExactlyOnceWith({
      content: 'olá',
      clientId: expect.any(String),
    });
    // The own message arrives over SSE, not from the action's result.
    expect(contents()).toEqual(['primeira', 'terceira']);
    expect(sources.instances).toHaveLength(1);
  });

  it('o botão "Sair" chama a action leave', async () => {
    const { actions: acts } = renderStream();

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));

    expect(acts.leave).toHaveBeenCalledOnce();
  });
});
