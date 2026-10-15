import { render, screen } from '@testing-library/react';
import { TypingIndicator } from './typing-indicator';

describe('TypingIndicator', () => {
  it('sem ninguém digitando não renderiza nada', () => {
    const { container } = render(<TypingIndicator names={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    [['Ana'], 'Ana está digitando…'],
    [['Ana', 'Carlos'], 'Ana e Carlos estão digitando…'],
    [['Ana', 'Carlos', 'Bia'], 'Várias pessoas estão digitando…'],
  ])('com %j mostra %j', (names, text) => {
    render(<TypingIndicator names={names} />);

    expect(screen.getByText(text)).toBeInTheDocument();
  });
});
