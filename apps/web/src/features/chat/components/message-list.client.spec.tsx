import { render, screen, within } from '@testing-library/react';
import { chatDictionary as t } from '../chat.dictionary';
import { ana, makeConversation, makeMessage, me } from '../test-fixtures';
import { MessageList } from './message-list.client';

describe('MessageList', () => {
  it('é uma lista com aria-live="polite"', () => {
    render(<MessageList messages={makeConversation()} meId={me.id} />);

    const list = screen.getByRole('list', { name: t.room.messages });
    expect(list).toHaveAttribute('aria-live', 'polite');
    expect(within(list).getAllByRole('listitem')).toHaveLength(6);
  });

  it('vazia mostra o estado vazio do dicionário', () => {
    render(<MessageList messages={[]} meId={me.id} />);

    expect(screen.getByText(t.room.empty)).toBeInTheDocument();
  });

  it('JOINED e LEFT viram mensagens de sistema com o nome do autor', () => {
    render(
      <MessageList
        messages={[
          makeMessage({ id: '1', type: 'JOINED', content: '', author: ana }),
          makeMessage({ id: '2', type: 'LEFT', content: '', author: ana }),
        ]}
        meId={me.id}
      />,
    );

    expect(screen.getByText('Ana entrou no chat')).toHaveClass('text-fg-muted');
    expect(screen.getByText('Ana saiu do chat')).toHaveClass('text-fg-muted');
    expect(screen.queryByTestId('message-bubble')).not.toBeInTheDocument();
  });

  it('separa mensagens próprias das dos outros pelo meId', () => {
    render(<MessageList messages={makeConversation()} meId={me.id} />);

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
    render(<MessageList messages={makeConversation()} meId={ana.id} />);

    expect(screen.getAllByText('Você')).toHaveLength(2);
    expect(screen.getByText('Bruno')).toBeInTheDocument();
  });

  it('renderiza o footer depois da lista', () => {
    render(<MessageList messages={[]} meId={me.id} footer={<p>rodapé</p>} />);

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

        render(<MessageList messages={makeConversation()} meId={me.id} />, {
          container: main,
        });

        expect(main.scrollTop).toBe(2400);
      },
    );

    it('pula ancestrais que não rolam até achar o que rola (como o <main> da Sala)', () => {
      const main = scroller('auto', 3600);
      const column = document.createElement('div');
      Object.defineProperty(column, 'scrollHeight', { value: 9999 });
      main.appendChild(column);

      render(<MessageList messages={makeConversation()} meId={me.id} />, {
        container: column,
      });

      expect(main.scrollTop).toBe(3600);
      expect(column.scrollTop).toBe(0);
    });
  });
});
