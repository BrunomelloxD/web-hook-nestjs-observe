import { render, screen } from '@testing-library/react';
import { chatDictionary as t } from '../chat.dictionary';
import { ChatRoomView } from './chat-room-view';

function renderView() {
  const { container } = render(
    <ChatRoomView
      header={<p>cabeçalho</p>}
      list={<p>lista</p>}
      composer={<p>composer</p>}
    />,
  );
  return container.firstElementChild as HTMLElement;
}

describe('ChatRoomView', () => {
  it('renderiza os slots header, list e composer, nessa ordem', () => {
    renderView();

    const header = screen.getByText('cabeçalho');
    const list = screen.getByText('lista');
    const composer = screen.getByText('composer');
    expect(header.compareDocumentPosition(list)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(list.compareDocumentPosition(composer)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('ocupa a altura da tela em coluna, com cabeçalho e composer fixos', () => {
    const root = renderView();

    expect(root).toHaveClass('flex', 'h-dvh', 'flex-col');
    expect(screen.getByText('cabeçalho').parentElement).toHaveClass('shrink-0');
    expect(screen.getByTestId('composer-slot')).toHaveClass('shrink-0');
  });

  it('só a lista rola, e a área rolável é alcançável pelo teclado', () => {
    renderView();

    const scroller = screen.getByRole('main', { name: t.room.messages });
    expect(scroller).toContainElement(screen.getByText('lista'));
    expect(scroller).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto');
    expect(scroller).toHaveAttribute('tabindex', '0');
    expect(scroller).not.toContainElement(screen.getByText('cabeçalho'));
    expect(scroller).not.toContainElement(screen.getByText('composer'));
  });

  it('limita a lista e o composer a 800 px centralizados a partir de xl', () => {
    renderView();

    expect(screen.getByText('lista').parentElement).toHaveClass(
      'xl:mx-auto',
      'xl:max-w-[800px]',
    );
    expect(screen.getByText('composer').parentElement).toHaveClass(
      'xl:mx-auto',
      'xl:max-w-[800px]',
    );
  });
});
