import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeEventSources } from '../../../../test/fake-event-source';
import { chatDictionary as t } from '../chat.dictionary';
import type {
  SendMessageAction,
  SendMessageResult,
} from '../schemas/message.schema';
import type { LoadOlderMessagesResult } from '../chat.types';
import {
  ana,
  carlos,
  makeMessage,
  makeParticipant,
  me,
} from '../test-fixtures';
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

  it('abre um único EventSource para /chat/stream?after=<último seq do SSR> e o fecha ao desmontar (SSE-02 AC8, RECON-01 AC8)', () => {
    const { sources, unmount } = renderStream();

    expect(sources.instances.map((source) => source.url)).toEqual([
      '/chat/stream?after=3',
    ]);
    expect(sources.instances[0]!.closed).toBe(false);

    unmount();

    expect(sources.instances[0]!.closed).toBe(true);
  });

  it('sala sem mensagens → abre /chat/stream sem after (RECON-01 AC8)', () => {
    const { sources } = renderStream({ initialMessages: [] });

    expect(sources.instances.map((source) => source.url)).toEqual([
      '/chat/stream',
    ]);
  });

  it('o stream continua com o after da montagem depois de novas mensagens', () => {
    const { sources, emit } = renderStream();

    emit(
      'message',
      makeMessage({ id: 'm-4', seq: 4, author: ana, content: 'quarta' }),
    );

    expect(sources.instances.map((source) => source.url)).toEqual([
      '/chat/stream?after=3',
    ]);
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

  it('o botão "Sair" chama a action leave', async () => {
    const { actions: acts } = renderStream();

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));

    expect(acts.leave).toHaveBeenCalledOnce();
  });

  it('"error" do EventSource mostra "Reconectando…" no Composer e "open" esconde (RECON-02 AC5-6)', () => {
    const { sources } = renderStream();
    const source = sources.instances[0]!;
    expect(screen.queryByText(t.errors.reconnecting)).toBeNull();

    act(() => {
      source.dispatchEvent(new Event('error'));
    });

    const notice = screen.getByText('Reconectando…');
    expect(
      within(screen.getByTestId('composer-slot')).getByText('Reconectando…'),
    ).toBe(notice);

    act(() => {
      source.dispatchEvent(new Event('open'));
    });

    expect(screen.queryByText('Reconectando…')).toBeNull();
  });

  describe('envio otimista (OPT-01, RATE-02)', () => {
    const RATE_LIMITED =
      'Você está enviando mensagens rápido demais. Aguarde alguns segundos.';

    type Call = {
      input: { content: string; clientId: string };
      resolve: (result: SendMessageResult) => void;
      reject: (error: Error) => void;
    };

    /** An action whose result the test decides, one call at a time. */
    function controlledSend() {
      const calls: Call[] = [];
      const send = vi.fn<SendMessageAction>(
        (input) =>
          new Promise((resolve, reject) =>
            calls.push({ input, resolve, reject }),
          ),
      );
      return { send, calls };
    }

    function renderWith(send: SendMessageAction) {
      return renderStream({
        actions: { send, leave: vi.fn(async () => {}) },
      });
    }

    async function type(text: string) {
      await userEvent.type(
        screen.getByRole('textbox', { name: 'Mensagem' }),
        `${text}{Enter}`,
      );
    }

    function bubbleOf(text: string) {
      return screen
        .getByText(text)
        .closest<HTMLElement>('[data-testid="message-bubble"]')!;
    }

    /** The server's copy of what the test sent. */
    function stored(seq: number, clientId: string) {
      return makeMessage({
        id: `m-${seq}`,
        seq,
        author: me,
        content: 'olá',
        clientId,
      });
    }

    it('enviar mostra a mensagem na hora, no fim, como "Enviando…", com o clientId gerado (AC1)', async () => {
      const { send, calls } = controlledSend();
      renderWith(send);

      await type('olá');

      expect(contents()).toEqual(['primeira', 'terceira', 'olá']);
      expect(within(bubbleOf('olá')).getByText('Enviando…')).toBeVisible();
      expect(send).toHaveBeenCalledExactlyOnceWith({
        content: 'olá',
        clientId: expect.any(String),
      });
      expect(calls).toHaveLength(1);
      expect(screen.getByRole('textbox', { name: 'Mensagem' })).toHaveValue('');
    });

    it('evento SSE com o mesmo clientId deixa uma mensagem só, e a resposta depois não duplica (AC2)', async () => {
      const { send, calls } = controlledSend();
      const { emit } = renderWith(send);
      await type('olá');
      const { clientId } = calls[0]!.input;

      emit('message', stored(4, clientId));

      expect(contents()).toEqual(['primeira', 'terceira', 'olá']);
      expect(screen.queryByText('Enviando…')).toBeNull();

      await act(async () =>
        calls[0]!.resolve({ ok: true, message: stored(4, clientId) }),
      );

      expect(contents()).toEqual(['primeira', 'terceira', 'olá']);
    });

    it('resposta da action antes do SSE substitui a pendente; o SSE depois não duplica (AC3)', async () => {
      const { send, calls } = controlledSend();
      const { emit } = renderWith(send);
      await type('olá');
      const { clientId } = calls[0]!.input;

      await act(async () =>
        calls[0]!.resolve({ ok: true, message: stored(2, clientId) }),
      );

      // Confirmed: placed by seq, no longer "Enviando…".
      expect(contents()).toEqual(['primeira', 'olá', 'terceira']);
      expect(screen.queryByText('Enviando…')).toBeNull();

      emit('message', stored(2, clientId));

      expect(contents()).toEqual(['primeira', 'olá', 'terceira']);
    });

    it.each([
      [
        'ok: false',
        (call: Call) => call.resolve({ ok: false, reason: 'unexpected' }),
      ],
      [
        'a action rejeita (rede)',
        (call: Call) => call.reject(new Error('Failed to fetch')),
      ],
    ])(
      '%s → "Não enviada · Tentar de novo" e nenhum aviso no Composer (AC4)',
      async (_case, fail) => {
        const { send, calls } = controlledSend();
        renderWith(send);
        await type('olá');

        await act(async () => fail(calls[0]!));

        const bubble = bubbleOf('olá');
        expect(within(bubble).getByText('Não enviada')).toBeVisible();
        expect(
          within(bubble).getByRole('button', { name: 'Tentar de novo' }),
        ).toBeVisible();
        expect(screen.queryByRole('alert')).toBeNull();
      },
    );

    it('"Tentar de novo" chama a action com o mesmo clientId e conteúdo e volta para "Enviando…" (AC5)', async () => {
      const { send, calls } = controlledSend();
      renderWith(send);
      await type('olá');
      await act(async () =>
        calls[0]!.resolve({ ok: false, reason: 'unexpected' }),
      );

      await userEvent.click(
        screen.getByRole('button', { name: 'Tentar de novo' }),
      );

      expect(send).toHaveBeenCalledTimes(2);
      expect(calls[1]!.input).toEqual(calls[0]!.input);
      expect(within(bubbleOf('olá')).getByText('Enviando…')).toBeVisible();
      expect(screen.queryByText('Não enviada')).toBeNull();

      await act(async () =>
        calls[1]!.resolve({
          ok: true,
          message: stored(4, calls[0]!.input.clientId),
        }),
      );

      expect(contents()).toEqual(['primeira', 'terceira', 'olá']);
      expect(screen.queryByText('Enviando…')).toBeNull();
    });

    it('rate_limited → aviso de limite no Composer e a mensagem como "Não enviada" (RATE-02 AC4-5)', async () => {
      const { send, calls } = controlledSend();
      renderWith(send);
      await type('olá');

      await act(async () =>
        calls[0]!.resolve({ ok: false, reason: 'rate_limited', retryAfter: 4 }),
      );

      const alert = within(screen.getByTestId('composer-slot')).getByRole(
        'alert',
      );
      expect(alert).toHaveTextContent(RATE_LIMITED);
      expect(within(bubbleOf('olá')).getByText('Não enviada')).toBeVisible();
    });

    it('o aviso de limite sai no próximo envio', async () => {
      const { send, calls } = controlledSend();
      renderWith(send);
      await type('olá');
      await act(async () =>
        calls[0]!.resolve({ ok: false, reason: 'rate_limited', retryAfter: 4 }),
      );
      expect(screen.getByRole('alert')).toHaveTextContent(RATE_LIMITED);

      await type('outra');

      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('o aviso de limite sai ao acionar "Tentar de novo" (RATE-02 AC4)', async () => {
      const { send, calls } = controlledSend();
      renderWith(send);
      await type('olá');
      await act(async () =>
        calls[0]!.resolve({ ok: false, reason: 'rate_limited', retryAfter: 4 }),
      );
      expect(screen.getByRole('alert')).toHaveTextContent(RATE_LIMITED);

      await userEvent.click(
        screen.getByRole('button', { name: 'Tentar de novo' }),
      );

      expect(screen.queryByRole('alert')).toBeNull();
      expect(within(bubbleOf('olá')).getByText('Enviando…')).toBeVisible();
    });

    it('enviar rola a lista até o fim, mesmo lendo mensagens antigas (SCROLL-01 AC5)', async () => {
      const main = document.createElement('div');
      main.style.overflowY = 'auto';
      Object.defineProperty(main, 'scrollHeight', { value: 3000 });
      Object.defineProperty(main, 'clientHeight', { value: 500 });
      document.body.appendChild(main);
      const { send } = controlledSend();
      render(
        <ChatStream
          me={me}
          initialMessages={initialMessages}
          initialOnline={2}
          actions={{ send, leave: vi.fn(async () => {}) }}
          createEventSource={fakeEventSources().create}
        />,
        { container: main },
      );
      main.scrollTop = 0;
      main.dispatchEvent(new Event('scroll'));

      await type('olá');

      expect(main.scrollTop).toBe(3000);
    });
  });

  describe('digitando (TYPE-02 AC7-11)', () => {
    const bia = makeParticipant({
      id: 'a1b2c3d4-0000-4000-8000-000000000004',
      name: 'Bia',
    });

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-29T17:00:00.000Z'));
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.useRealTimers();
    });

    function typingOf(participant: { id: string; name: string }) {
      return { participant: { id: participant.id, name: participant.name } };
    }

    function after(ms: number) {
      act(() => {
        vi.advanceTimersByTime(ms);
      });
    }

    it('evento de Ana → "Ana está digitando…", entre a lista e o Composer; some em 5 s (AC8)', () => {
      const { emit } = renderStream();

      emit('typing', typingOf(ana));

      const notice = screen.getByText('Ana está digitando…');
      expect(notice.closest('[aria-live="polite"]')).not.toBeNull();
      expect(
        screen
          .getByRole('list', { name: 'Mensagens' })
          .compareDocumentPosition(notice),
      ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(
        notice.compareDocumentPosition(
          screen.getByRole('textbox', { name: 'Mensagem' }),
        ),
      ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

      after(4_999);
      expect(screen.getByText('Ana está digitando…')).toBeInTheDocument();
      after(1);
      expect(screen.queryByText('Ana está digitando…')).toBeNull();
    });

    it('novo evento em 4 s estende até 9 s (AC8)', () => {
      const { emit } = renderStream();

      emit('typing', typingOf(ana));
      after(4_000);
      emit('typing', typingOf(ana));

      after(4_999);
      expect(screen.getByText('Ana está digitando…')).toBeInTheDocument();
      after(1);
      expect(screen.queryByText('Ana está digitando…')).toBeNull();
    });

    it('mensagem USER de Ana a remove na hora (AC9)', () => {
      const { emit } = renderStream();
      emit('typing', typingOf(ana));

      emit(
        'message',
        makeMessage({ id: 'm-4', seq: 4, author: ana, content: 'pronto' }),
      );

      expect(screen.queryByText('Ana está digitando…')).toBeNull();
      expect(contents()).toEqual(['primeira', 'terceira', 'pronto']);
    });

    it('evento do próprio participante não aparece (AC7)', () => {
      const { emit } = renderStream();

      emit('typing', typingOf(me));

      expect(screen.queryByText(/digitando/)).toBeNull();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('dois nomes → "Ana e Carlos estão digitando…" (AC10)', () => {
      const { emit } = renderStream();

      emit('typing', typingOf(ana));
      emit('typing', typingOf(carlos));

      expect(
        screen.getByText('Ana e Carlos estão digitando…'),
      ).toBeInTheDocument();
    });

    it('três → "Várias pessoas estão digitando…" (AC11)', () => {
      const { emit } = renderStream();

      emit('typing', typingOf(ana));
      emit('typing', typingOf(carlos));
      emit('typing', typingOf(bia));

      expect(
        screen.getByText('Várias pessoas estão digitando…'),
      ).toBeInTheDocument();
    });

    it('cada um expira no seu tempo: Carlos fica depois que Ana sai', () => {
      const { emit } = renderStream();

      emit('typing', typingOf(ana));
      after(2_000);
      emit('typing', typingOf(carlos));
      after(3_000);

      expect(screen.getByText('Carlos está digitando…')).toBeInTheDocument();
      after(2_000);
      expect(screen.queryByText(/digitando/)).toBeNull();
    });

    it('timer que dispara antes do vencimento ainda expira o aviso', () => {
      const { emit } = renderStream();
      emit('typing', typingOf(ana));
      // The clock is behind the timer: Date.now() reads 1 ms early when it fires.
      const realNow = Date.now;
      vi.spyOn(Date, 'now').mockImplementation(() => realNow() - 1);

      after(5_000);

      expect(screen.queryByText('Ana está digitando…')).toBeNull();
    });

    it('sem ninguém digitando não há timer pendente', () => {
      const { emit } = renderStream();
      expect(vi.getTimerCount()).toBe(0);

      emit('typing', typingOf(ana));
      expect(vi.getTimerCount()).toBe(1);
      after(5_000);

      expect(vi.getTimerCount()).toBe(0);
    });

    it('teclas no Composer chamam actions.typing (TYPE-01 AC1)', () => {
      const typing = vi.fn(async () => {});
      renderStream({ actions: { ...actions(), typing } });

      fireEvent.change(screen.getByRole('textbox', { name: 'Mensagem' }), {
        target: { value: 'O' },
      });

      expect(typing).toHaveBeenCalledOnce();
    });
  });

  it('falha de transporte de actions.typing não vira unhandledRejection e a sala continua enviando (TYPE-01 AC1)', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      // A plain function: vi.fn handles the promise it returns and would hide the rejection.
      const typing = () => Promise.reject(new Error('offline'));
      const acts = { ...actions(), typing };
      renderStream({ actions: acts });

      await userEvent.type(
        screen.getByRole('textbox', { name: 'Mensagem' }),
        'oi{Enter}',
      );
      // Node reports an unhandled rejection once the microtasks drain.
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(unhandled).toEqual([]);
      expect(acts.send).toHaveBeenCalledWith({
        content: 'oi',
        clientId: expect.any(String),
      });
      expect(contents()).toEqual(['primeira', 'terceira', 'oi']);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  describe('mensagens anteriores (HIST-01)', () => {
    const LOAD = 'Carregar mensagens anteriores';

    /** A full first page: seq 51 to 100. */
    const fullPage = Array.from({ length: 50 }, (_, i) =>
      makeMessage({
        id: `m-${51 + i}`,
        seq: 51 + i,
        author: ana,
        content: `mensagem ${51 + i}`,
      }),
    );
    const olderPage = Array.from({ length: 20 }, (_, i) =>
      makeMessage({
        id: `m-${31 + i}`,
        seq: 31 + i,
        author: carlos,
        content: `mensagem ${31 + i}`,
      }),
    );

    function controlledLoad() {
      let settle!: (result: LoadOlderMessagesResult | Error) => void;
      const loadOlder = vi.fn(
        () =>
          new Promise<LoadOlderMessagesResult>((resolve, reject) => {
            settle = (result) =>
              result instanceof Error ? reject(result) : resolve(result);
          }),
      );
      return {
        loadOlder,
        settle: (result: LoadOlderMessagesResult | Error) =>
          act(async () => settle(result)),
      };
    }

    it('sem a action loadOlder, não há botão', () => {
      renderStream({ initialMessages: fullPage });

      expect(screen.queryByRole('button', { name: LOAD })).toBeNull();
    });

    it('49 mensagens iniciais → sem botão (AC1)', () => {
      const { loadOlder } = controlledLoad();
      renderStream({
        initialMessages: fullPage.slice(1),
        actions: { ...actions(), loadOlder },
      });

      expect(screen.queryByRole('button', { name: LOAD })).toBeNull();
    });

    it('o clique chama loadOlder com o menor seq, mostra "Carregando…" e insere o resultado no topo (AC2, AC4-5)', async () => {
      const { loadOlder, settle } = controlledLoad();
      renderStream({
        initialMessages: fullPage,
        actions: { ...actions(), loadOlder },
      });

      await userEvent.click(screen.getByRole('button', { name: LOAD }));

      expect(loadOlder).toHaveBeenCalledExactlyOnceWith(51);
      expect(
        screen.getByRole('button', { name: 'Carregando…' }),
      ).toBeDisabled();

      await settle({ ok: true, items: olderPage });

      expect(contents()).toEqual(
        Array.from({ length: 70 }, (_, i) => `mensagem ${31 + i}`),
      );
      expect(screen.queryByRole('button', { name: LOAD })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Carregando…' })).toBeNull();
    });

    it.each([
      ['{ ok: false }', { ok: false } as const],
      ['rejeição', new Error('offline')],
    ])('falha (%s) mantém o botão e mostra o erro (AC6)', async (_, result) => {
      const { loadOlder, settle } = controlledLoad();
      renderStream({
        initialMessages: fullPage,
        actions: { ...actions(), loadOlder },
      });

      await userEvent.click(screen.getByRole('button', { name: LOAD }));
      await settle(result);

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Não foi possível carregar as mensagens anteriores.',
      );
      expect(screen.getByRole('button', { name: LOAD })).toBeEnabled();
      expect(contents()).toHaveLength(50);
    });
  });
});
