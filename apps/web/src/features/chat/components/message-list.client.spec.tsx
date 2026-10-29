import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { chatDictionary as t } from '../chat.dictionary';
import type { ChatItem } from '../state/chat-room.reducer';
import {
  ana,
  asItems,
  makeConversation,
  makeMessage,
  me,
} from '../test-fixtures';
import { MessageList } from './message-list.client';

describe('MessageList', () => {
  it('é uma lista com aria-live="polite"', () => {
    render(<MessageList items={asItems(makeConversation())} meId={me.id} />);

    const list = screen.getByRole('list', { name: t.room.messages });
    expect(list).toHaveAttribute('aria-live', 'polite');
    expect(within(list).getAllByRole('listitem')).toHaveLength(6);
  });

  it('vazia mostra o estado vazio do dicionário', () => {
    render(<MessageList items={[]} meId={me.id} />);

    expect(screen.getByText(t.room.empty)).toBeInTheDocument();
  });

  it('JOINED e LEFT viram mensagens de sistema com o nome do autor', () => {
    render(
      <MessageList
        items={asItems([
          makeMessage({ id: '1', type: 'JOINED', content: '', author: ana }),
          makeMessage({ id: '2', type: 'LEFT', content: '', author: ana }),
        ])}
        meId={me.id}
      />,
    );

    expect(screen.getByText('Ana entrou no chat')).toHaveClass('text-fg-muted');
    expect(screen.getByText('Ana saiu do chat')).toHaveClass('text-fg-muted');
    expect(screen.queryByTestId('message-bubble')).not.toBeInTheDocument();
  });

  it('separa mensagens próprias das dos outros pelo meId', () => {
    render(<MessageList items={asItems(makeConversation())} meId={me.id} />);

    const own = screen
      .getByText('E aí, galera! Primeira vez aqui no chat.')
      .closest('[data-testid="message-bubble"]');
    const other = screen
      .getByText('Oi, pessoal! Alguém por aqui?')
      .closest('[data-testid="message-bubble"]');

    expect(own).toHaveClass('justify-end');
    expect(within(own as HTMLElement).getByText('Você')).toBeInTheDocument();
    expect(other).toHaveClass('justify-start');
    expect(within(other as HTMLElement).getByText('Ana')).toBeInTheDocument();
    expect(screen.getAllByText('Você')).toHaveLength(1);
  });

  it('com outro meId, a mesma mensagem deixa de ser própria', () => {
    render(<MessageList items={asItems(makeConversation())} meId={ana.id} />);

    expect(screen.getAllByText('Você')).toHaveLength(2);
    expect(screen.getByText('Bruno')).toBeInTheDocument();
  });

  it('renderiza o footer depois da lista', () => {
    render(<MessageList items={[]} meId={me.id} footer={<p>rodapé</p>} />);

    const list = screen.getByRole('list');
    const footer = screen.getByText('rodapé');
    expect(list.compareDocumentPosition(footer)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  describe('rolagem ao montar (ROOM-01 AC2)', () => {
    /** A scroll container with a fixed scrollHeight, since jsdom has no layout. */
    function scroller(overflowY: string, scrollHeight = 2400) {
      const element = document.createElement('div');
      element.style.overflowY = overflowY;
      Object.defineProperty(element, 'scrollHeight', { value: scrollHeight });
      Object.defineProperty(element, 'clientHeight', { value: 480 });
      document.body.appendChild(element);
      return element;
    }

    it.each(['auto', 'scroll'])(
      'o ancestral com overflow-y: %s termina rolado até o fim',
      (overflowY) => {
        const main = scroller(overflowY);

        render(
          <MessageList items={asItems(makeConversation())} meId={me.id} />,
          {
            container: main,
          },
        );

        expect(main.scrollTop).toBe(2400);
      },
    );

    it('pula ancestrais que não rolam até achar o que rola (como o <main> da Sala)', () => {
      const main = scroller('auto', 3600);
      const column = document.createElement('div');
      Object.defineProperty(column, 'scrollHeight', { value: 9999 });
      main.appendChild(column);

      render(<MessageList items={asItems(makeConversation())} meId={me.id} />, {
        container: column,
      });

      expect(main.scrollTop).toBe(3600);
      expect(column.scrollTop).toBe(0);
    });
  });

  describe('mensagens pendentes (OPT-01)', () => {
    const CLIENT_ID = 'c0000000-0000-4000-8000-000000000001';

    function pending(status: 'sending' | 'failed'): ChatItem {
      return {
        kind: 'pending',
        clientId: CLIENT_ID,
        content: 'ainda não confirmada',
        createdAt: '2026-10-14T17:40:00.000Z',
        status,
      };
    }

    function bubbleOf(text: string) {
      return screen
        .getByText(text)
        .closest<HTMLElement>('[data-testid="message-bubble"]')!;
    }

    it('pendente "sending" aparece no fim, à direita, como "Você" e "Enviando…" (AC1)', () => {
      render(
        <MessageList
          items={[...asItems(makeConversation()), pending('sending')]}
          meId={me.id}
        />,
      );

      const items = within(
        screen.getByRole('list', { name: t.room.messages }),
      ).getAllByRole('listitem');
      expect(items).toHaveLength(7);
      expect(items[6]).toHaveTextContent('ainda não confirmada');
      const bubble = bubbleOf('ainda não confirmada');
      expect(bubble).toHaveClass('justify-end');
      expect(within(bubble).getByText('Você')).toBeInTheDocument();
      expect(within(bubble).getByText('Enviando…')).toBeInTheDocument();
      expect(
        within(bubble).queryByRole('button', { name: 'Tentar de novo' }),
      ).toBeNull();
    });

    it('pendente "failed" mostra "Não enviada · Tentar de novo" e o clique chama onRetry com o clientId (AC4)', async () => {
      const onRetry = vi.fn();
      render(
        <MessageList
          items={[pending('failed')]}
          meId={me.id}
          onRetry={onRetry}
        />,
      );

      const bubble = bubbleOf('ainda não confirmada');
      expect(within(bubble).getByText('Não enviada')).toBeInTheDocument();
      expect(within(bubble).queryByText('Enviando…')).toBeNull();
      await userEvent.click(
        within(bubble).getByRole('button', { name: 'Tentar de novo' }),
      );

      expect(onRetry).toHaveBeenCalledExactlyOnceWith(CLIENT_ID);
    });

    it('sem onRetry, "Tentar de novo" não quebra', async () => {
      render(<MessageList items={[pending('failed')]} meId={me.id} />);

      await userEvent.click(
        screen.getByRole('button', { name: 'Tentar de novo' }),
      );

      expect(screen.getByText('Não enviada')).toBeInTheDocument();
    });
  });

  describe('"Novas mensagens ↓" (SCROLL-01)', () => {
    /** A scroll container 600 px above the bottom, as if reading old messages. */
    function readingOlder() {
      const main = document.createElement('div');
      main.style.overflowY = 'auto';
      const size = { scrollHeight: 2400 };
      Object.defineProperty(main, 'scrollHeight', {
        get: () => size.scrollHeight,
      });
      Object.defineProperty(main, 'clientHeight', { value: 480 });
      document.body.appendChild(main);
      return { main, size };
    }

    it('nova mensagem longe do fim mostra o botão; o clique rola até o fim e esconde (AC2-3)', async () => {
      const { main, size } = readingOlder();
      const conversation = asItems(makeConversation());
      const { rerender } = render(
        <MessageList items={conversation} meId={me.id} />,
        { container: main },
      );
      main.scrollTop = 1000;
      main.dispatchEvent(new Event('scroll'));
      expect(
        screen.queryByRole('button', { name: 'Novas mensagens ↓' }),
      ).toBeNull();

      size.scrollHeight = 2500;
      rerender(
        <MessageList
          items={[
            ...conversation,
            ...asItems([makeMessage({ id: 'novo', seq: 7, content: 'nova' })]),
          ]}
          meId={me.id}
        />,
      );

      expect(main.scrollTop).toBe(1000);
      await userEvent.click(
        screen.getByRole('button', { name: 'Novas mensagens ↓' }),
      );

      expect(main.scrollTop).toBe(2500);
      expect(
        screen.queryByRole('button', { name: 'Novas mensagens ↓' }),
      ).toBeNull();
    });

    it('scrollKey novo rola até o fim mesmo longe dele (AC5)', () => {
      const { main, size } = readingOlder();
      const conversation = asItems(makeConversation());
      const { rerender } = render(
        <MessageList items={conversation} meId={me.id} scrollKey={0} />,
        { container: main },
      );
      main.scrollTop = 1000;
      main.dispatchEvent(new Event('scroll'));

      size.scrollHeight = 2500;
      rerender(
        <MessageList
          items={[
            ...conversation,
            {
              kind: 'pending',
              clientId: 'c0000000-0000-4000-8000-000000000009',
              content: 'enviada agora',
              createdAt: '2026-10-14T17:40:00.000Z',
              status: 'sending',
            },
          ]}
          meId={me.id}
          scrollKey={1}
        />,
      );

      expect(main.scrollTop).toBe(2500);
      expect(
        screen.queryByRole('button', { name: 'Novas mensagens ↓' }),
      ).toBeNull();
    });
  });

  describe('mensagens anteriores (HIST-01)', () => {
    const LOAD = 'Carregar mensagens anteriores';

    function history(
      status: 'idle' | 'loading' | 'error' = 'idle',
      hasMore = true,
    ) {
      return { hasMore, status, onLoad: vi.fn() };
    }

    it('com hasMore, o botão aparece no topo, antes da lista (AC1)', () => {
      render(
        <MessageList
          items={asItems(makeConversation())}
          meId={me.id}
          history={history()}
        />,
      );

      const button = screen.getByRole('button', { name: LOAD });
      expect(button).toBeEnabled();
      expect(button.compareDocumentPosition(screen.getByRole('list'))).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    });

    it('sem hasMore, o botão some (AC5)', () => {
      render(
        <MessageList
          items={asItems(makeConversation())}
          meId={me.id}
          history={history('idle', false)}
        />,
      );

      expect(screen.queryByRole('button', { name: LOAD })).toBeNull();
    });

    it('o clique chama onLoad (AC2)', async () => {
      const h = history();
      render(
        <MessageList
          items={asItems(makeConversation())}
          meId={me.id}
          history={h}
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: LOAD }));

      expect(h.onLoad).toHaveBeenCalledOnce();
    });

    it('loading desabilita o botão com "Carregando…" (AC4)', () => {
      render(
        <MessageList
          items={asItems(makeConversation())}
          meId={me.id}
          history={history('loading')}
        />,
      );

      expect(
        screen.getByRole('button', { name: 'Carregando…' }),
      ).toBeDisabled();
      expect(screen.queryByRole('button', { name: LOAD })).toBeNull();
    });

    it('error mostra o erro do dicionário e mantém o botão (AC6)', () => {
      render(
        <MessageList
          items={asItems(makeConversation())}
          meId={me.id}
          history={history('error')}
        />,
      );

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Não foi possível carregar as mensagens anteriores.',
      );
      expect(screen.getByRole('button', { name: LOAD })).toBeEnabled();
    });

    it('sem error, nenhum alerta', () => {
      render(
        <MessageList
          items={asItems(makeConversation())}
          meId={me.id}
          history={history()}
        />,
      );

      expect(screen.queryByRole('alert')).toBeNull();
    });

    describe('posição de leitura (AC3)', () => {
      /** A scroller at the top of the list, as when the reader clicks the button. */
      function atTop() {
        const main = document.createElement('div');
        main.style.overflowY = 'auto';
        const size = { scrollHeight: 2400 };
        Object.defineProperty(main, 'scrollHeight', {
          get: () => size.scrollHeight,
        });
        Object.defineProperty(main, 'clientHeight', { value: 480 });
        document.body.appendChild(main);
        return { main, size };
      }

      function range(first: number, last: number) {
        return asItems(
          Array.from({ length: last - first + 1 }, (_, i) =>
            makeMessage({
              id: `m-${first + i}`,
              seq: first + i,
              content: `mensagem ${first + i}`,
            }),
          ),
        );
      }

      it('depois de inserir no topo, scrollTop aumenta pela diferença de scrollHeight e "Novas mensagens ↓" não aparece', () => {
        const { main, size } = atTop();
        const { rerender } = render(
          <MessageList
            items={range(51, 100)}
            meId={me.id}
            history={history()}
          />,
          { container: main },
        );
        main.scrollTop = 0;
        main.dispatchEvent(new Event('scroll'));

        size.scrollHeight = 4000;
        rerender(
          <MessageList
            items={range(1, 100)}
            meId={me.id}
            history={history('idle', false)}
          />,
        );

        expect(main.scrollTop).toBe(1600);
        expect(
          screen.queryByRole('button', { name: 'Novas mensagens ↓' }),
        ).toBeNull();
      });

      it('mensagem ao vivo no fim não mexe na posição; a do topo continua a contar como nova', () => {
        const { main, size } = atTop();
        const { rerender } = render(
          <MessageList
            items={range(51, 100)}
            meId={me.id}
            history={history()}
          />,
          { container: main },
        );
        main.scrollTop = 0;
        main.dispatchEvent(new Event('scroll'));

        // Older page and a live message in the same list: only the live one is new.
        size.scrollHeight = 2500;
        rerender(
          <MessageList
            items={range(51, 101)}
            meId={me.id}
            history={history('loading')}
          />,
        );
        expect(main.scrollTop).toBe(0);
        size.scrollHeight = 4100;
        rerender(
          <MessageList
            items={range(1, 101)}
            meId={me.id}
            history={history()}
          />,
        );

        expect(main.scrollTop).toBe(1600);
        expect(
          screen.getByRole('button', { name: 'Novas mensagens ↓' }),
        ).toBeInTheDocument();
      });

      it('lista que começa vazia não compensa quando a primeira mensagem chega', () => {
        const { main, size } = atTop();
        const { rerender } = render(<MessageList items={[]} meId={me.id} />, {
          container: main,
        });

        size.scrollHeight = 2500;
        rerender(<MessageList items={range(1, 1)} meId={me.id} />);

        // At the bottom: follows the new message, no extra offset.
        expect(main.scrollTop).toBe(2500);
      });
    });
  });
});
