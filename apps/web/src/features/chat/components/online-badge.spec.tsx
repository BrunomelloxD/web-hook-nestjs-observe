import { render, screen } from '@testing-library/react';
import { OnlineBadge } from './online-badge';

describe('OnlineBadge', () => {
  it.each([
    [1, '1 pessoa online'],
    [5, '5 pessoas online'],
  ])('com %i mostra %j', (count, text) => {
    render(<OnlineBadge count={count} />);

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('mostra o ponto com a cor de online, escondido dos leitores de tela', () => {
    render(<OnlineBadge count={2} />);

    const dot = screen.getByTestId('online-dot');
    expect(dot).toHaveClass('bg-online');
    expect(dot).toHaveAttribute('aria-hidden', 'true');
  });
});
